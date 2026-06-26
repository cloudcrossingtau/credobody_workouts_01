import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getMyProfile, getAvatarUrl } from "@/lib/profile";
import AuthScreen from "./AuthScreen";
import SetPasswordScreen from "./SetPasswordScreen";
import ProfileScreen from "./ProfileScreen";

// ---- 型 ----
type Unit = "time" | "count"; // time=実施時間(分) / count=種目数(回)
type Item = { id: string; name: string; color: string; unit: Unit };
// key = `${itemId}:${YYYY-MM-DD}` -> 値（time: 分 / count: 回）
type Minutes = Record<string, number>;

// ---- 日付ユーティリティ ----
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date, weekStart: number) {
  const x = startOfDay(d);
  const diff = (x.getDay() - weekStart + 7) % 7;
  return addDays(x, -diff);
}
const WD = ["日", "月", "火", "水", "木", "金", "土"];

// 分 -> 時間（合計表示）
function fmtHours(min: number) {
  const h = min / 60;
  return Number.isInteger(h) ? `${h}` : h.toFixed(1);
}
// 数値の見やすい目盛り
function niceScale(maxVal: number) {
  if (maxVal <= 0) return { max: 1, step: 1 };
  const rough = maxVal / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const cand = [1, 2, 2.5, 5, 10].map((c) => c * pow);
  const step = cand.find((c) => c >= rough) ?? 10 * pow;
  return { max: Math.ceil(maxVal / step) * step, step };
}

// レガシーデータ移行用：単位が未設定の項目の既定
function defaultUnit(name: string): Unit {
  return name === "ラン" || name === "バイク" ? "time" : "count";
}

// ---- 初期サンプル（縦軸＝トレーニング項目 / 設定画面で編集可） ----
const SEED_ITEMS: Item[] = [
  { id: "i1", name: "ラン", color: "#3b82f6", unit: "time" },
  { id: "i2", name: "バイク", color: "#06b6d4", unit: "time" },
  { id: "i3", name: "脚", color: "#10b981", unit: "count" },
  { id: "i4", name: "腕", color: "#f59e0b", unit: "count" },
  { id: "i5", name: "腹筋", color: "#ef4444", unit: "count" },
  { id: "i6", name: "背筋", color: "#8b5cf6", unit: "count" },
];
const COLOR_CHOICES = [
  "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6",
];
const QUICK_TIME = [15, 30, 45, 60, 90];
const QUICK_COUNT = [1, 2, 3, 4, 5];

// グラフ色（色分けはしない＝グループごとに単色）
const TIME_COLOR = "#3b82f6";
const COUNT_COLOR = "#10b981";

// ---- デモ用データ生成（過去42日ぶん。項目ごとに曜日パターンで実施） ----
function seedMinutes(list: Item[]): Minutes {
  const m: Minutes = {};
  const today = startOfDay(new Date());
  const patterns = [
    [1, 3, 5, 0], // 月水金日
    [6, 0], //       土日
    [2, 4], //       火木
    [1, 4], //       月木
    [2, 5], //       火金
    [3, 6], //       水土
  ];
  for (let back = 0; back < 42; back++) {
    const d = addDays(today, -back);
    const dow = d.getDay();
    list.forEach((it, idx) => {
      const p = patterns[idx % patterns.length];
      if (!p.includes(dow)) return;
      m[`${it.id}:${ymd(d)}`] =
        it.unit === "time"
          ? 30 + ((back * 7 + idx * 13 + dow * 5) % 5) * 15 // 30〜90分
          : 1 + ((back * 3 + idx * 7 + dow * 2) % 4); // 1〜4回
    });
  }
  return m;
}

const LS_ITEMS = "training.items.v1";
const LS_MIN = "training.minutes.v1";
const LS_WEEKSTART = "training.weekStart.v1";

const CHART_H = 160; // グラフ描画領域の高さ(px)
const AXIS_W = 32; // y軸ラベル幅(px)
const DAY_W = 44; // 日別バー1本ぶんの幅(px)
const WEEK_W = 64; // 週別バー1本ぶんの幅(px)
const GRID_PAST_DAYS = 180; // 記録グリッドで遡れる日数（最大スクロール範囲）
const NAME_W = 88; // 種目名カラム幅(px)
const CELL_W = 44; // 記録グリッドの1日セル幅(px)

export default function TrainingLog() {
  const [items, setItems] = useState<Item[]>([]);
  const [minutes, setMinutes] = useState<Minutes>({});
  const [weekStart, setWeekStart] = useState<number>(1); // 0=日..6=土（既定=月）
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<
    "grid" | "settings" | "charts" | "profile"
  >("grid");

  // 認証（Supabase 設定時のみ有効。未設定ならローカルのみで動作）
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  // 招待メール/再設定リンク経由＝初回パスワード設定が必要
  const [needsPassword, setNeedsPassword] = useState(false);
  // 招待フォーム
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  // セル編集モーダル
  const [editing, setEditing] = useState<{ itemId: string; date: Date } | null>(
    null,
  );
  const [editVal, setEditVal] = useState("");

  // 設定: 項目ごとのインライン色ピッカー
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  // 設定: 新規追加フォーム
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLOR_CHOICES[0]);
  const [newUnit, setNewUnit] = useState<Unit>("time");
  // 設定: 参照/編集モード（編集前の状態をスナップショットして キャンセルで復元）
  const [settingsEditing, setSettingsEditing] = useState(false);
  const [settingsSnapshot, setSettingsSnapshot] = useState<{
    items: Item[];
    minutes: Minutes;
    weekStart: number;
  } | null>(null);

  // 横スクロール用ref（開いたら右端=最新へ）
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const timeDailyRef = useRef<HTMLDivElement>(null);
  const timeWeeklyRef = useRef<HTMLDivElement>(null);
  const countDailyRef = useRef<HTMLDivElement>(null);
  const countWeeklyRef = useRef<HTMLDivElement>(null);

  // 認証セッションの監視
  useEffect(() => {
    if (!supabase) {
      setAuthChecked(true);
      return;
    }
    // 招待/パスワード再設定リンク経由かどうか（URLハッシュで判定）
    if (
      typeof window !== "undefined" &&
      /type=(invite|recovery)/.test(window.location.hash)
    ) {
      setNeedsPassword(true);
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setNeedsPassword(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ログイン中ユーザーのプロフィール（role / アバター）を取得
  function refreshProfile() {
    getMyProfile().then((p) => {
      setMyRole(p?.role ?? null);
      setMyAvatarUrl(getAvatarUrl(p?.avatar_path ?? null));
    });
  }
  useEffect(() => {
    if (!supabase || !session) {
      setMyRole(null);
      setMyAvatarUrl(null);
      return;
    }
    refreshProfile();
  }, [session]);

  async function invite() {
    if (!supabase) return;
    const email = inviteEmail.trim();
    if (!email) return;
    setInviteBusy(true);
    setInviteMsg(null);
    try {
      const { error } = await supabase.functions.invoke("invite-user", {
        body: { email, redirectTo: window.location.origin },
      });
      if (error) {
        // Edge Function が返した本当のエラー本文を取り出す
        let detail = error.message;
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const b = await ctx.json();
            if (b?.error) detail = b.error;
          } catch {
            /* 本文がJSONでない場合は message のまま */
          }
        }
        throw new Error(detail);
      }
      setInviteMsg(`${email} に招待メールを送信しました。`);
      setInviteEmail("");
    } catch (e) {
      setInviteMsg(
        "招待に失敗しました：" +
          (e instanceof Error ? e.message : "不明なエラー"),
      );
    } finally {
      setInviteBusy(false);
    }
  }

  // 初期ロード
  useEffect(() => {
    try {
      const rawI = localStorage.getItem(LS_ITEMS);
      const rawM = localStorage.getItem(LS_MIN);
      const rawW = localStorage.getItem(LS_WEEKSTART);
      if (rawI) {
        const parsed: Item[] = JSON.parse(rawI);
        // 単位が無い古いデータは名前から既定を補完
        setItems(
          parsed.map((it) => ({ ...it, unit: it.unit ?? defaultUnit(it.name) })),
        );
        setMinutes(rawM ? JSON.parse(rawM) : {});
      } else {
        setItems(SEED_ITEMS);
        setMinutes(seedMinutes(SEED_ITEMS));
      }
      if (rawW !== null) setWeekStart(Number(rawW));
    } catch {
      setItems(SEED_ITEMS);
      setMinutes(seedMinutes(SEED_ITEMS));
    }
    setLoaded(true);
  }, []);

  // 保存
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(LS_ITEMS, JSON.stringify(items));
    localStorage.setItem(LS_MIN, JSON.stringify(minutes));
    localStorage.setItem(LS_WEEKSTART, String(weekStart));
  }, [items, minutes, weekStart, loaded]);

  // 各画面を開いたら右端（最新）へスクロール
  useEffect(() => {
    const toEnd = (r: RefObject<HTMLDivElement>) => {
      if (r.current) r.current.scrollLeft = r.current.scrollWidth;
    };
    if (view === "charts") {
      toEnd(timeDailyRef);
      toEnd(timeWeeklyRef);
      toEnd(countDailyRef);
      toEnd(countWeeklyRef);
    }
    if (view === "grid") toEnd(gridScrollRef);
  }, [view, weekStart, loaded, session, authChecked]);

  // 設定タブから離れたら参照モードに戻す
  useEffect(() => {
    if (view !== "settings") {
      setSettingsEditing(false);
      setSettingsSnapshot(null);
    }
  }, [view]);

  const todayStr = ymd(new Date());

  // ---- セル入力 ----
  function openEditor(itemId: string, d: Date) {
    const cur = minutes[`${itemId}:${ymd(d)}`] ?? 0;
    setEditing({ itemId, date: d });
    setEditVal(cur ? String(cur) : "");
  }
  function applyEditor() {
    if (!editing) return;
    const key = `${editing.itemId}:${ymd(editing.date)}`;
    const v = Math.max(0, Math.round(Number(editVal) || 0));
    setMinutes((prev) => {
      const next = { ...prev };
      if (v > 0) next[key] = v;
      else delete next[key];
      return next;
    });
    setEditing(null);
  }
  function clearEditor() {
    if (!editing) return;
    const key = `${editing.itemId}:${ymd(editing.date)}`;
    setMinutes((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setEditing(null);
  }

  // 直近7日（今日含む）の合計（生値）
  function recent7(itemId: string) {
    let m = 0;
    for (let k = 0; k < 7; k++) {
      m += minutes[`${itemId}:${ymd(addDays(startOfDay(new Date()), -k))}`] ?? 0;
    }
    return m;
  }

  // ---- 設定: 項目の編集 ----
  function updateItem(id: string, patch: Partial<Item>) {
    setItems((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function moveItem(id: string, dir: -1 | 1) {
    setItems((arr) => {
      const i = arr.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return arr;
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function deleteItem(id: string) {
    const it = items.find((x) => x.id === id);
    if (it && !confirm(`「${it.name}」を削除しますか？記録も削除されます。`)) return;
    setItems((arr) => arr.filter((x) => x.id !== id));
    setMinutes((m) => {
      const next: Minutes = {};
      for (const k of Object.keys(m)) {
        if (!k.startsWith(`${id}:`)) next[k] = m[k];
      }
      return next;
    });
  }
  function addItem() {
    const name = newName.trim();
    if (!name) return;
    const id = `i${Date.now()}`;
    setItems((arr) => [...arr, { id, name, color: newColor, unit: newUnit }]);
    setNewName("");
    setNewColor(COLOR_CHOICES[0]);
    setNewUnit("time");
  }
  function loadDemo() {
    if (
      !confirm("既存の記録を置き換えて、デモ用データ（過去6週間）を投入します。よろしいですか？")
    )
      return;
    setMinutes(seedMinutes(items));
  }
  function clearAllMinutes() {
    if (!confirm("すべての記録を削除します。よろしいですか？")) return;
    setMinutes({});
  }
  function enterSettingsEdit() {
    setSettingsSnapshot({ items, minutes, weekStart });
    setSettingsEditing(true);
    setColorPickerFor(null);
  }
  function saveSettingsEdit() {
    setSettingsSnapshot(null);
    setSettingsEditing(false);
    setColorPickerFor(null);
  }
  function cancelSettingsEdit() {
    if (settingsSnapshot) {
      setItems(settingsSnapshot.items);
      setMinutes(settingsSnapshot.minutes);
      setWeekStart(settingsSnapshot.weekStart);
    }
    setSettingsSnapshot(null);
    setSettingsEditing(false);
    setColorPickerFor(null);
  }

  const editingItem = editing
    ? items.find((x) => x.id === editing.itemId)
    : null;

  // ---- 下部タブバー ----
  const TABS: { id: "grid" | "charts" | "settings"; label: string; icon: ReactNode }[] = [
    {
      id: "grid",
      label: "ホーム",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
          <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5z" />
        </svg>
      ),
    },
    {
      id: "charts",
      label: "グラフ",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
          <path d="M3 3v18h18" />
          <path d="M8 17v-4" />
          <path d="M13 17v-8" />
          <path d="M18 17v-6" />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "設定",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
        </svg>
      ),
    },
  ];
  const tabBar = (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-card-border bg-card-bg dark:border-slate-800 dark:bg-slate-900"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="主要ナビゲーション"
    >
      <div className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const active = view === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 ${
                active ? "text-accent" : "text-slate-500 dark:text-slate-400"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {t.icon}
              <span className="text-[12px] font-medium leading-none">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  // ===================== 認証ゲート =====================
  // Supabase 設定時のみ。未ログインならログイン画面、招待リンク経由ならパスワード設定。
  if (supabase) {
    if (!authChecked) {
      return (
        <div className="py-24 text-center text-[15px] text-muted">
          読み込み中…
        </div>
      );
    }
    if (session && needsPassword) {
      return (
        <SetPasswordScreen
          onDone={() => {
            setNeedsPassword(false);
            if (typeof window !== "undefined") {
              history.replaceState(null, "", window.location.pathname);
            }
          }}
        />
      );
    }
    if (!session) {
      return <AuthScreen />;
    }
  }

  // ===================== プロフィールビュー =====================
  if (view === "profile") {
    return (
      <>
        <ProfileScreen
          onBack={() => setView("grid")}
          onChanged={refreshProfile}
        />
        {tabBar}
      </>
    );
  }

  // ===================== 設定ビュー =====================
  if (view === "settings") {
    return (
      <>
        <div className="pb-24">
          <header
            className="sticky top-0 z-30 -mx-4 mb-3 border-b border-card-border bg-background px-4"
            style={{ paddingTop: "var(--safe-top)" }}
          >
            <div className="flex h-14 items-center justify-between">
              <span className="text-[17px] font-semibold text-foreground">
                設定
              </span>
              {!settingsEditing && (
                <button
                  onClick={enterSettingsEdit}
                  className="rounded-full border border-card-border px-3 py-1 text-[14px] font-medium text-accent"
                >
                  編集
                </button>
              )}
            </div>
          </header>

          {settingsEditing ? (
          <>
          {/* 週の開始曜日 */}
          <section className="mt-5">
            <h2 className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">
              週の開始曜日
            </h2>
            <div className="mt-2 flex gap-1.5">
              {WD.map((w, idx) => (
                <button
                  key={idx}
                  onClick={() => setWeekStart(idx)}
                  className={`flex h-10 flex-1 items-center justify-center rounded-lg text-[15px] font-semibold ${
                    weekStart === idx
                      ? "bg-accent text-white"
                      : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </section>

          {/* トレーニング項目 */}
          <section className="mt-7">
            <h2 className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">
              トレーニング項目
            </h2>
            <div className="mt-2 overflow-hidden rounded-2xl border border-card-border bg-card-bg dark:border-slate-800 dark:bg-slate-900">
              {items.map((it, idx) => (
                <div
                  key={it.id}
                  className="border-b border-slate-100 px-2 py-2 last:border-b-0 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2">
                    {/* 並べ替え */}
                    <div className="flex flex-col">
                      <button
                        onClick={() => moveItem(it.id, -1)}
                        disabled={idx === 0}
                        className="px-1 text-[14px] leading-tight text-slate-600 disabled:opacity-30 dark:text-slate-300"
                        aria-label="上へ"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveItem(it.id, 1)}
                        disabled={idx === items.length - 1}
                        className="px-1 text-[14px] leading-tight text-slate-600 disabled:opacity-30 dark:text-slate-300"
                        aria-label="下へ"
                      >
                        ▼
                      </button>
                    </div>
                    {/* 色 */}
                    <button
                      onClick={() =>
                        setColorPickerFor((p) => (p === it.id ? null : it.id))
                      }
                      className="h-8 w-8 shrink-0 rounded-full ring-1 ring-slate-300 dark:ring-slate-600"
                      style={{ backgroundColor: it.color }}
                      aria-label="色を変更"
                    />
                    {/* 名前 */}
                    <input
                      value={it.name}
                      onChange={(e) => updateItem(it.id, { name: e.target.value })}
                      placeholder="項目名"
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-2 text-[15px] font-medium text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                    {/* 削除 */}
                    <button
                      onClick={() => deleteItem(it.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500 text-[15px] font-semibold text-white"
                      aria-label="削除"
                    >
                      ×
                    </button>
                  </div>

                  {/* 単位 */}
                  <div className="mt-2 flex items-center gap-2 pl-1">
                    <span className="text-[13px] text-muted">
                      記録の単位
                    </span>
                    <div className="flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
                      <button
                        onClick={() => updateItem(it.id, { unit: "time" })}
                        className={`px-3 py-1 text-[14px] font-medium ${
                          it.unit === "time"
                            ? "bg-accent text-white"
                            : "bg-card-bg text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                        }`}
                      >
                        時間
                      </button>
                      <button
                        onClick={() => updateItem(it.id, { unit: "count" })}
                        className={`px-3 py-1 text-[14px] font-medium ${
                          it.unit === "count"
                            ? "bg-accent text-white"
                            : "bg-card-bg text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                        }`}
                      >
                        種目数
                      </button>
                    </div>
                  </div>

                  {/* インライン色ピッカー */}
                  {colorPickerFor === it.id && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {COLOR_CHOICES.map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            updateItem(it.id, { color: c });
                            setColorPickerFor(null);
                          }}
                          className={`h-8 w-8 rounded-full ${
                            it.color === c
                              ? "ring-2 ring-slate-500 ring-offset-2 dark:ring-offset-slate-900"
                              : ""
                          }`}
                          style={{ backgroundColor: c }}
                          aria-label={c}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {items.length === 0 && (
                <p className="px-4 py-6 text-center text-[15px] text-slate-700 dark:text-slate-300">
                  項目がありません。下から追加してください。
                </p>
              )}
            </div>

            {/* 新規追加 */}
            <div className="mt-4 rounded-2xl border border-card-border bg-card-bg p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                項目を追加
              </p>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="項目名（例：水泳）"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <p className="mt-3 text-[15px] font-medium text-slate-800 dark:text-slate-200">
                記録の単位
              </p>
              <div className="mt-1.5 flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
                <button
                  onClick={() => setNewUnit("time")}
                  className={`flex-1 px-3 py-2 text-[15px] font-medium ${
                    newUnit === "time"
                      ? "bg-accent text-white"
                      : "bg-card-bg text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  }`}
                >
                  時間
                </button>
                <button
                  onClick={() => setNewUnit("count")}
                  className={`flex-1 px-3 py-2 text-[15px] font-medium ${
                    newUnit === "count"
                      ? "bg-accent text-white"
                      : "bg-card-bg text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  }`}
                >
                  種目数
                </button>
              </div>
              <p className="mt-3 text-[15px] font-medium text-slate-800 dark:text-slate-200">
                色
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {COLOR_CHOICES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`h-8 w-8 rounded-full ${
                      newColor === c
                        ? "ring-2 ring-slate-500 ring-offset-2 dark:ring-offset-slate-900"
                        : ""
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
              <button
                onClick={addItem}
                className="mt-4 w-full rounded-xl bg-accent px-4 py-2.5 text-[16px] font-semibold text-white active:opacity-90"
              >
                ＋ 追加
              </button>
            </div>
          </section>

          {/* 保存 / キャンセル */}
          <div className="mt-7 flex gap-2">
            <button
              onClick={saveSettingsEdit}
              className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-[16px] font-semibold text-white active:opacity-90"
            >
              保存
            </button>
            <button
              onClick={cancelSettingsEdit}
              className="flex-1 rounded-xl border border-card-border px-4 py-2.5 text-[16px] font-medium text-foreground"
            >
              キャンセル
            </button>
          </div>
          </>
          ) : (
          <>
          {/* 週の開始曜日（参照） */}
          <section className="mt-1">
            <h2 className="text-[16px] font-semibold text-foreground">
              週の開始曜日
            </h2>
            <p className="mt-1.5 text-[15px] text-foreground">{WD[weekStart]}曜</p>
          </section>

          {/* トレーニング項目（参照） */}
          <section className="mt-6">
            <h2 className="text-[16px] font-semibold text-foreground">
              トレーニング項目
            </h2>
            <div className="mt-2 overflow-hidden rounded-2xl border border-card-border bg-card-bg">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center gap-2.5 border-b border-card-border px-3 py-2.5 last:border-b-0"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: it.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[15px] text-foreground">
                    {it.name}
                  </span>
                  <span className="text-[13px] text-muted">
                    {it.unit === "time" ? "時間" : "種目数"}
                  </span>
                </div>
              ))}
              {items.length === 0 && (
                <p className="px-4 py-6 text-center text-[15px] text-muted">
                  項目がありません。「編集」から追加してください。
                </p>
              )}
            </div>
          </section>

          {/* データ管理 */}
          <section className="mt-7">
            <h2 className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">
              データ
            </h2>
            <div className="mt-2 flex gap-2">
              <button
                onClick={loadDemo}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-[15px] font-medium text-slate-800 dark:border-slate-600 dark:text-slate-100"
              >
                デモ用データを投入
              </button>
              <button
                onClick={clearAllMinutes}
                className="flex-1 rounded-xl border border-red-300 px-4 py-2.5 text-[15px] font-medium text-red-600 dark:border-red-800 dark:text-red-400"
              >
                全記録を削除
              </button>
            </div>
          </section>

          {/* ユーザー招待（管理者/開発者のみ） */}
          {supabase && session && (myRole === "admin" || myRole === "developer") && (
            <section className="mt-7">
              <h2 className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">
                ユーザー招待
              </h2>
              <div className="mt-2 flex gap-2">
                <input
                  type="email"
                  inputMode="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="招待するメールアドレス"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  onClick={invite}
                  disabled={inviteBusy}
                  className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-[15px] font-semibold text-white active:opacity-90 disabled:opacity-50"
                >
                  {inviteBusy ? "送信中…" : "招待"}
                </button>
              </div>
              {inviteMsg && (
                <p className="mt-2 text-[14px] text-slate-700 dark:text-slate-300">
                  {inviteMsg}
                </p>
              )}
            </section>
          )}

          </>
          )}
        </div>
        {tabBar}
      </>
    );
  }

  // ===================== グラフビュー =====================
  if (view === "charts") {
    const today = startOfDay(new Date());
    // 表示範囲：最古の記録日（最低14日）〜今日
    const recYmds = Object.keys(minutes).map((k) => k.slice(k.indexOf(":") + 1));
    const firstYmd = recYmds.length
      ? recYmds.reduce((a, b) => (a < b ? a : b))
      : ymd(today);
    const [fy, fm, fd] = firstYmd.split("-").map(Number);
    let dayStart = new Date(fy, fm - 1, fd);
    const minStart = addDays(today, -13);
    if (dayStart.getTime() > minStart.getTime()) dayStart = minStart;
    const dayCount =
      Math.round((today.getTime() - dayStart.getTime()) / 86400000) + 1;
    const dayList = Array.from({ length: dayCount }, (_, i) =>
      addDays(dayStart, i),
    );
    const wFirst = startOfWeek(dayStart, weekStart);
    const wLast = startOfWeek(today, weekStart);
    const weekCount =
      Math.round((wLast.getTime() - wFirst.getTime()) / (7 * 86400000)) + 1;
    const weekList = Array.from({ length: weekCount }, (_, i) =>
      addDays(wFirst, i * 7),
    );

    const timeItems = items.filter((it) => it.unit === "time");
    const countItems = items.filter((it) => it.unit === "count");

    const sumDay = (group: Item[], d: Date) =>
      group.reduce((s, it) => s + (minutes[`${it.id}:${ymd(d)}`] ?? 0), 0);
    const sumWeek = (group: Item[], ws: Date) => {
      let s = 0;
      for (let k = 0; k < 7; k++) s += sumDay(group, addDays(ws, k));
      return s;
    };

    const dailyX = (d: Date): ReactNode => {
      const wd = d.getDay();
      const isFirst = d.getDate() === 1;
      return (
        <div className="text-center">
          <div
            className={`text-[12px] ${
              wd === 0
                ? "text-red-500"
                : wd === 6
                  ? "text-blue-500"
                  : "text-muted"
            }`}
          >
            {isFirst ? `${d.getMonth() + 1}/1` : d.getDate()}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-500">
            {WD[wd]}
          </div>
        </div>
      );
    };
    const weeklyX = (ws: Date): ReactNode => {
      const we = addDays(ws, 6);
      return (
        <div className="text-center text-[11px] text-muted">
          {ws.getMonth() + 1}/{ws.getDate()}
          <br />〜{we.getMonth() + 1}/{we.getDate()}
        </div>
      );
    };

    const fmtH = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(1));
    const fmtC = (v: number) => `${v}`;

    // 単色の棒グラフ（色分けなし）
    const renderBarChart = (
      cols: { value: number; x: ReactNode }[],
      color: string,
      fmt: (v: number) => string,
      barW: number,
      scrollRef: RefObject<HTMLDivElement>,
    ) => {
      const scale = niceScale(Math.max(0, ...cols.map((c) => c.value)));
      const ticks: number[] = [];
      for (let t = 0; t <= scale.max + 1e-9; t += scale.step) ticks.push(t);
      return (
        <div className="mt-3 flex items-start rounded-2xl border border-card-border bg-card-bg p-3 dark:border-slate-800 dark:bg-slate-900">
          {/* 固定Y軸 */}
          <div className="relative shrink-0" style={{ width: AXIS_W, height: CHART_H }}>
            {ticks.map((t, i) => (
              <div
                key={i}
                className="absolute right-1 -translate-y-1/2 text-right text-[11px] text-slate-500 dark:text-slate-400"
                style={{ top: `${(1 - t / scale.max) * 100}%` }}
              >
                {fmt(t)}
              </div>
            ))}
          </div>
          {/* スクロールするバー領域 */}
          <div ref={scrollRef} className="flex-1 overflow-x-auto">
            <div style={{ minWidth: cols.length * barW }}>
              <div className="relative" style={{ height: CHART_H }}>
                {ticks.map((t, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 -translate-y-1/2 border-t border-slate-100 dark:border-slate-800"
                    style={{ top: `${(1 - t / scale.max) * 100}%` }}
                  />
                ))}
                <div className="absolute inset-0 flex items-stretch">
                  {cols.map((col, i) => (
                    <div
                      key={i}
                      className="flex h-full flex-col items-center justify-end gap-0.5"
                      style={{ width: barW }}
                    >
                      {col.value > 0 && (
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          {fmt(col.value)}
                        </span>
                      )}
                      <div
                        className="w-full max-w-[2.2rem] rounded-t-md"
                        style={{
                          height: `${(col.value / scale.max) * 100}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-1 flex">
                {cols.map((col, i) => (
                  <div key={i} style={{ width: barW }}>
                    {col.x}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <>
        <div className="pb-24">
          <header
            className="sticky top-0 z-30 -mx-4 mb-3 border-b border-card-border bg-background px-4"
            style={{ paddingTop: "var(--safe-top)" }}
          >
            <div className="flex h-14 items-center">
              <span className="text-[17px] font-semibold text-foreground">
                グラフ
              </span>
            </div>
          </header>

          {timeItems.length > 0 && (
            <>
              <section className="mt-5">
                <h2 className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">
                  時間（h）・日別
                </h2>
                {renderBarChart(
                  dayList.map((d) => ({
                    value: sumDay(timeItems, d) / 60,
                    x: dailyX(d),
                  })),
                  TIME_COLOR,
                  fmtH,
                  DAY_W,
                  timeDailyRef,
                )}
              </section>
              <section className="mt-6">
                <h2 className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">
                  時間（h）・週別
                </h2>
                {renderBarChart(
                  weekList.map((ws) => ({
                    value: sumWeek(timeItems, ws) / 60,
                    x: weeklyX(ws),
                  })),
                  TIME_COLOR,
                  fmtH,
                  WEEK_W,
                  timeWeeklyRef,
                )}
              </section>
            </>
          )}

          {countItems.length > 0 && (
            <>
              <section className="mt-7">
                <h2 className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">
                  種目数（回）・日別
                </h2>
                {renderBarChart(
                  dayList.map((d) => ({
                    value: sumDay(countItems, d),
                    x: dailyX(d),
                  })),
                  COUNT_COLOR,
                  fmtC,
                  DAY_W,
                  countDailyRef,
                )}
              </section>
              <section className="mt-6">
                <h2 className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">
                  種目数（回）・週別
                </h2>
                {renderBarChart(
                  weekList.map((ws) => ({
                    value: sumWeek(countItems, ws),
                    x: weeklyX(ws),
                  })),
                  COUNT_COLOR,
                  fmtC,
                  WEEK_W,
                  countWeeklyRef,
                )}
              </section>
            </>
          )}

          {items.length === 0 && (
            <p className="mt-6 text-center text-[15px] text-slate-700 dark:text-slate-300">
              項目がありません。「設定」タブから登録してください。
            </p>
          )}
        </div>
        {tabBar}
      </>
    );
  }

  // ===================== 記録（グリッド）ビュー =====================
  // 表示範囲：最古の記録日（最大 GRID_PAST_DAYS 日前）〜 今日
  const gToday = startOfDay(new Date());
  const gRecYmds = Object.keys(minutes).map((k) => k.slice(k.indexOf(":") + 1));
  const gFirstYmd = gRecYmds.length
    ? gRecYmds.reduce((a, b) => (a < b ? a : b))
    : ymd(gToday);
  const [gfy, gfm, gfd] = gFirstYmd.split("-").map(Number);
  let gStart = new Date(gfy, gfm - 1, gfd);
  const gMinStart = addDays(gToday, -GRID_PAST_DAYS);
  if (gStart.getTime() > gMinStart.getTime()) gStart = gMinStart;
  const gCount =
    Math.round((gToday.getTime() - gStart.getTime()) / 86400000) + 1;
  const gridDays = Array.from({ length: gCount }, (_, i) => addDays(gStart, i));

  return (
    <>
      <div className="pb-24">
        {/* ヘッダー（左: CredoBody ロゴ / 右: ユーザーアイコン）。スクロールしても固定 */}
        <header
          className="sticky top-0 z-30 -mx-4 mb-3 border-b border-card-border bg-background px-4"
          style={{ paddingTop: "var(--safe-top)" }}
        >
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/icon.png" alt="" className="h-7 w-7" />
              <span className="text-[17px] font-semibold text-foreground">
                CredoBody
              </span>
            </div>
            {supabase && session && (
              <button
                onClick={() => setView("profile")}
                className="h-9 w-9 overflow-hidden rounded-full bg-slate-200 ring-1 ring-card-border dark:bg-slate-700"
                aria-label="プロフィール"
              >
                {myAvatarUrl ? (
                  <img
                    src={myAvatarUrl}
                    alt="プロフィール"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-muted">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      className="h-5 w-5"
                    >
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                    </svg>
                  </span>
                )}
              </button>
            )}
          </div>
        </header>

        {items.length === 0 ? (
          <p className="mt-6 text-center text-[15px] text-muted">
            種目がありません。「設定」タブから登録してください。
          </p>
        ) : (
          <>
            <div className="mb-2 flex justify-end">
              <button
                onClick={() => {
                  if (gridScrollRef.current)
                    gridScrollRef.current.scrollLeft =
                      gridScrollRef.current.scrollWidth;
                }}
                className="rounded-full border border-card-border px-3 py-1 text-[13px] font-medium text-muted"
              >
                今日へ
              </button>
            </div>
            {/* 種目名は固定・日付部分のみ横スクロール */}
            <div
              ref={gridScrollRef}
              className="mt-3 overflow-x-auto rounded-2xl border border-card-border bg-card-bg dark:border-slate-800 dark:bg-slate-900"
            >
              <div style={{ minWidth: NAME_W + gridDays.length * CELL_W }}>
                {/* 日付ヘッダー */}
                <div className="flex items-stretch border-b border-card-border dark:border-slate-800">
                  <div
                    className="sticky left-0 z-20 flex items-center border-r border-card-border bg-card-bg px-3 py-2 text-[15px] font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                    style={{ width: NAME_W }}
                  >
                    種目
                  </div>
                  {gridDays.map((d, i) => {
                    const isToday = ymd(d) === todayStr;
                    const wd = d.getDay();
                    const isWeekStart = wd === weekStart;
                    const isFirst = d.getDate() === 1;
                    return (
                      <div
                        key={i}
                        className={`shrink-0 py-2 text-center ${
                          isWeekStart
                            ? "border-l border-slate-300 dark:border-slate-600"
                            : ""
                        }`}
                        style={{ width: CELL_W }}
                      >
                        <div
                          className={`text-[13px] ${
                            wd === 0
                              ? "text-red-500"
                              : wd === 6
                                ? "text-blue-500"
                                : "text-muted"
                          }`}
                        >
                          {WD[wd]}
                        </div>
                        <div
                          className={`mx-auto mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[14px] font-semibold ${
                            isToday
                              ? "bg-accent text-white"
                              : "text-slate-800 dark:text-slate-100"
                          }`}
                        >
                          {isFirst ? `${d.getMonth() + 1}/1` : d.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 種目行 */}
                {items.map((it) => {
                  const sum = recent7(it.id);
                  return (
                    <div
                      key={it.id}
                      className="flex items-stretch border-b border-slate-100 last:border-b-0 dark:border-slate-800"
                    >
                      <div
                        className="sticky left-0 z-10 flex items-center gap-1.5 border-r border-card-border bg-card-bg px-2 py-2 dark:border-slate-800 dark:bg-slate-900"
                        style={{ width: NAME_W }}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: it.color }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium text-slate-900 dark:text-slate-100">
                            {it.name}
                          </span>
                          <span className="block text-[12px] text-muted">
                            7日 {it.unit === "time" ? `${fmtHours(sum)}h` : `${sum}回`}
                          </span>
                        </span>
                      </div>
                      {gridDays.map((d, i) => {
                        const val = minutes[`${it.id}:${ymd(d)}`] ?? 0;
                        const isWeekStart = d.getDay() === weekStart;
                        return (
                          <button
                            key={i}
                            onClick={() => openEditor(it.id, d)}
                            className={`flex h-12 shrink-0 items-center justify-center active:bg-slate-100 dark:active:bg-slate-800 ${
                              isWeekStart
                                ? "border-l border-slate-300 dark:border-slate-600"
                                : ""
                            }`}
                            style={{ width: CELL_W }}
                          >
                            <span
                              className="flex h-8 min-w-8 items-center justify-center rounded-lg px-1 text-[13px] font-semibold"
                              style={
                                val
                                  ? { backgroundColor: it.color, color: "#fff" }
                                  : { boxShadow: "inset 0 0 0 1.5px rgb(203 213 225)" }
                              }
                            >
                              {val ? `${val}` : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* セル入力モーダル */}
      {editing && editingItem && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card-bg p-5 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: editingItem.color }}
              />
              <div>
                <div className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">
                  {editingItem.name}
                </div>
                <div className="text-[13px] text-muted">
                  {editing.date.getMonth() + 1}/{editing.date.getDate()}（
                  {WD[editing.date.getDay()]}）
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                placeholder="0"
                autoFocus
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[18px] font-semibold text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <span className="text-[16px] font-medium text-slate-700 dark:text-slate-300">
                {editingItem.unit === "time" ? "分" : "回"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(editingItem.unit === "time" ? QUICK_TIME : QUICK_COUNT).map(
                (m) => (
                  <button
                    key={m}
                    onClick={() => setEditVal(String(m))}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-[15px] font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {m}
                    {editingItem.unit === "time" ? "分" : "回"}
                  </button>
                ),
              )}
            </div>

            <button
              onClick={applyEditor}
              className="mt-5 w-full rounded-xl bg-accent px-4 py-2.5 text-[16px] font-semibold text-white active:opacity-90"
            >
              保存
            </button>
            <div className="mt-2 flex gap-2">
              <button
                onClick={clearEditor}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-[16px] font-medium text-slate-800 dark:border-slate-600 dark:text-slate-100"
              >
                クリア
              </button>
              <button
                onClick={() => setEditing(null)}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-[16px] font-medium text-slate-800 dark:border-slate-600 dark:text-slate-100"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
      {tabBar}
    </>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  pullRemote,
  saveItems,
  saveWeekStart,
  deleteAllRecords,
  replaceAllRecords,
  uuid,
} from "@/lib/sync";
import { getMyProfile } from "@/lib/profile";
import {
  type Item,
  type Minutes,
  type Unit,
  WD,
  COLOR_CHOICES,
  SEED_ITEMS,
  seedMinutes,
} from "@/lib/training";

export function Settings() {
  const [items, setItems] = useState<Item[]>([]);
  const [minutes, setMinutes] = useState<Minutes>({});
  const [weekStart, setWeekStart] = useState<number>(1);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [snapshot, setSnapshot] = useState<{
    items: Item[];
    minutes: Minutes;
    weekStart: number;
  } | null>(null);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLOR_CHOICES[0]);
  const [newUnit, setNewUnit] = useState<Unit>("time");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [dataBusy, setDataBusy] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  async function loadData() {
    if (!supabase) {
      setLoaded(true);
      return;
    }
    setLoaded(false);
    setLoadError(null);
    try {
      const remote = await pullRemote();
      if (remote) {
        setItems(remote.items);
        setMinutes(remote.minutes);
        if (remote.weekStart != null) setWeekStart(remote.weekStart);
      }
      const p = await getMyProfile();
      setMyRole(p?.role ?? null);
      setLoaded(true);
    } catch (e) {
      console.warn("[load] failed:", e);
      setLoadError("データの読み込みに失敗しました。通信状況を確認してください。");
    }
  }
  useEffect(() => {
    loadData();
  }, []);

  // ---- 項目編集（ローカル）----
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
      for (const k of Object.keys(m)) if (!k.startsWith(`${id}:`)) next[k] = m[k];
      return next;
    });
  }
  function addItem() {
    const name = newName.trim();
    if (!name) return;
    setItems((arr) => [
      ...arr,
      { id: uuid(), name, color: newColor, unit: newUnit },
    ]);
    setNewName("");
    setNewColor(COLOR_CHOICES[0]);
    setNewUnit("time");
  }

  function enterEdit() {
    setSnapshot({ items, minutes, weekStart });
    setEditing(true);
    setColorPickerFor(null);
    setSaveError(null);
  }
  async function saveEdit() {
    setSaving(true);
    setSaveError(null);
    try {
      if (supabase) {
        await saveItems(items);
        await saveWeekStart(weekStart);
      }
      setSnapshot(null);
      setEditing(false);
      setColorPickerFor(null);
    } catch (e) {
      console.warn("[settings] save failed:", e);
      setSaveError("保存に失敗しました。通信状況を確認してもう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }
  function cancelEdit() {
    if (snapshot) {
      setItems(snapshot.items);
      setMinutes(snapshot.minutes);
      setWeekStart(snapshot.weekStart);
    }
    setSnapshot(null);
    setEditing(false);
    setColorPickerFor(null);
    setSaveError(null);
  }

  // ---- データ管理（開発用）----
  async function loadDemo() {
    const noItems = items.length === 0;
    const msg = noItems
      ? "デモ用の項目（ラン/バイク/脚/腕/腹筋/背筋）と過去6週間の記録を投入します。よろしいですか？"
      : "既存の記録を置き換えて、デモ用データ（過去6週間）を投入します。よろしいですか？";
    if (!confirm(msg)) return;
    setDataBusy(true);
    setDataError(null);
    try {
      let list = items;
      if (noItems) {
        list = SEED_ITEMS.map((it) => ({ ...it, id: uuid() }));
        if (supabase) await saveItems(list);
        setItems(list);
      }
      const demo = seedMinutes(list);
      if (supabase) await replaceAllRecords(demo);
      setMinutes(demo);
    } catch (e) {
      console.warn("[demo] failed:", e);
      setDataError("デモ用データの投入に失敗しました。");
    } finally {
      setDataBusy(false);
    }
  }
  async function clearAll() {
    if (!confirm("すべての記録を削除します。よろしいですか？")) return;
    setDataBusy(true);
    setDataError(null);
    try {
      if (supabase) await deleteAllRecords();
      setMinutes({});
    } catch (e) {
      console.warn("[clear] failed:", e);
      setDataError("記録の削除に失敗しました。");
    } finally {
      setDataBusy(false);
    }
  }

  // ---- 招待（admin/developer）----
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
        let detail = error.message;
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const b = await ctx.json();
            if (b?.error) detail = b.error;
          } catch {
            /* JSONでなければ message のまま */
          }
        }
        throw new Error(detail);
      }
      setInviteMsg(`${email} に招待メールを送信しました。`);
      setInviteEmail("");
    } catch (e) {
      setInviteMsg(
        "招待に失敗しました：" + (e instanceof Error ? e.message : "不明なエラー"),
      );
    } finally {
      setInviteBusy(false);
    }
  }

  if (!loaded) {
    return loadError ? (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[15px] text-foreground">{loadError}</p>
        <button
          onClick={loadData}
          className="rounded-xl bg-accent px-5 py-2.5 text-[16px] font-semibold text-white active:opacity-90"
        >
          再読み込み
        </button>
      </div>
    ) : (
      <div className="py-24 text-center text-[15px] text-muted">読み込み中…</div>
    );
  }

  const canInvite = myRole === "admin" || myRole === "developer";

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[20px] font-semibold text-foreground">設定</h2>
        {!editing && (
          <button
            onClick={enterEdit}
            className="rounded-full border border-slate-300 bg-card-bg px-4 py-1.5 text-[14px] font-medium text-accent hover:bg-slate-50"
          >
            編集
          </button>
        )}
      </div>

      {editing ? (
        <>
          {/* 週の開始曜日 */}
          <section className="mt-2">
            <h3 className="text-[16px] font-semibold text-slate-900">
              週の開始曜日
            </h3>
            <div className="mt-2 flex gap-1.5">
              {WD.map((w, idx) => (
                <button
                  key={idx}
                  onClick={() => setWeekStart(idx)}
                  className={`flex h-10 flex-1 items-center justify-center rounded-lg text-[15px] font-semibold ${
                    weekStart === idx
                      ? "bg-accent text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </section>

          {/* トレーニング項目 */}
          <section className="mt-7">
            <h3 className="text-[16px] font-semibold text-slate-900">
              トレーニング項目
            </h3>
            <div className="mt-2 overflow-hidden rounded-2xl border border-card-border bg-card-bg">
              {items.map((it, idx) => (
                <div
                  key={it.id}
                  className="border-b border-slate-100 px-3 py-2.5 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <button
                        onClick={() => moveItem(it.id, -1)}
                        disabled={idx === 0}
                        className="px-1 text-[14px] leading-tight text-slate-600 disabled:opacity-30"
                        aria-label="上へ"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveItem(it.id, 1)}
                        disabled={idx === items.length - 1}
                        className="px-1 text-[14px] leading-tight text-slate-600 disabled:opacity-30"
                        aria-label="下へ"
                      >
                        ▼
                      </button>
                    </div>
                    <button
                      onClick={() =>
                        setColorPickerFor((p) => (p === it.id ? null : it.id))
                      }
                      className="h-8 w-8 shrink-0 rounded-full ring-1 ring-slate-300"
                      style={{ backgroundColor: it.color }}
                      aria-label="色を変更"
                    />
                    <input
                      value={it.name}
                      onChange={(e) => updateItem(it.id, { name: e.target.value })}
                      placeholder="項目名"
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-card-bg px-2.5 py-2 text-[15px] font-medium text-slate-900 placeholder:text-slate-400"
                    />
                    <div className="flex overflow-hidden rounded-lg border border-slate-300">
                      <button
                        onClick={() => updateItem(it.id, { unit: "time" })}
                        className={`px-3 py-1.5 text-[14px] font-medium ${
                          it.unit === "time"
                            ? "bg-accent text-white"
                            : "bg-card-bg text-slate-800"
                        }`}
                      >
                        時間
                      </button>
                      <button
                        onClick={() => updateItem(it.id, { unit: "count" })}
                        className={`px-3 py-1.5 text-[14px] font-medium ${
                          it.unit === "count"
                            ? "bg-accent text-white"
                            : "bg-card-bg text-slate-800"
                        }`}
                      >
                        種目数
                      </button>
                    </div>
                    <button
                      onClick={() => deleteItem(it.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500 text-[15px] font-semibold text-white"
                      aria-label="削除"
                    >
                      ×
                    </button>
                  </div>
                  {colorPickerFor === it.id && (
                    <div className="mt-2 flex flex-wrap gap-2 pl-1">
                      {COLOR_CHOICES.map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            updateItem(it.id, { color: c });
                            setColorPickerFor(null);
                          }}
                          className={`h-8 w-8 rounded-full ${
                            it.color === c
                              ? "ring-2 ring-slate-500 ring-offset-2"
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
                <p className="px-4 py-6 text-center text-[15px] text-slate-700">
                  項目がありません。下から追加してください。
                </p>
              )}
            </div>

            {/* 新規追加 */}
            <div className="mt-4 rounded-2xl border border-card-border bg-card-bg p-4">
              <p className="text-[15px] font-semibold text-slate-900">項目を追加</p>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="項目名（例：水泳）"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-card-bg px-3 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400"
              />
              <p className="mt-3 text-[15px] font-medium text-slate-800">
                記録の単位
              </p>
              <div className="mt-1.5 flex overflow-hidden rounded-lg border border-slate-300">
                <button
                  onClick={() => setNewUnit("time")}
                  className={`flex-1 px-3 py-2 text-[15px] font-medium ${
                    newUnit === "time"
                      ? "bg-accent text-white"
                      : "bg-card-bg text-slate-800"
                  }`}
                >
                  時間
                </button>
                <button
                  onClick={() => setNewUnit("count")}
                  className={`flex-1 px-3 py-2 text-[15px] font-medium ${
                    newUnit === "count"
                      ? "bg-accent text-white"
                      : "bg-card-bg text-slate-800"
                  }`}
                >
                  種目数
                </button>
              </div>
              <p className="mt-3 text-[15px] font-medium text-slate-800">色</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {COLOR_CHOICES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`h-8 w-8 rounded-full ${
                      newColor === c ? "ring-2 ring-slate-500 ring-offset-2" : ""
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

          {saveError && (
            <p className="mt-5 text-[14px] font-medium text-red-600">{saveError}</p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={saveEdit}
              disabled={saving}
              className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-[16px] font-semibold text-white active:opacity-90 disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存"}
            </button>
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="flex-1 rounded-xl border border-slate-300 bg-card-bg px-4 py-2.5 text-[16px] font-medium text-foreground disabled:opacity-50"
            >
              キャンセル
            </button>
          </div>
        </>
      ) : (
        <>
          {/* 週の開始曜日（参照） */}
          <section className="mt-1">
            <h3 className="text-[16px] font-semibold text-foreground">
              週の開始曜日
            </h3>
            <p className="mt-1.5 text-[15px] text-foreground">{WD[weekStart]}曜</p>
          </section>

          {/* トレーニング項目（参照） */}
          <section className="mt-6">
            <h3 className="text-[16px] font-semibold text-foreground">
              トレーニング項目
            </h3>
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

          {/* ユーザー招待（管理者/開発者のみ） */}
          {canInvite && (
            <section className="mt-7">
              <h3 className="text-[16px] font-semibold text-slate-900">
                ユーザー招待
              </h3>
              <div className="mt-2 flex gap-2">
                <input
                  type="email"
                  inputMode="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="招待するメールアドレス"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-card-bg px-3 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400"
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
                <p className="mt-2 text-[14px] text-slate-700">{inviteMsg}</p>
              )}
            </section>
          )}

          {/* データ管理（開発用）。本番ビルドでは非表示。 */}
          {import.meta.env.DEV && (
            <section className="mt-7">
              <h3 className="text-[16px] font-semibold text-slate-900">
                データ（開発用）
              </h3>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={loadDemo}
                  disabled={dataBusy}
                  className="flex-1 rounded-xl border border-slate-300 bg-card-bg px-4 py-2.5 text-[15px] font-medium text-slate-800 disabled:opacity-50"
                >
                  デモ用データを投入
                </button>
                <button
                  onClick={clearAll}
                  disabled={dataBusy}
                  className="flex-1 rounded-xl border border-red-300 bg-card-bg px-4 py-2.5 text-[15px] font-medium text-red-600 disabled:opacity-50"
                >
                  全記録を削除
                </button>
              </div>
              {dataError && (
                <p className="mt-2 text-[14px] font-medium text-red-600">
                  {dataError}
                </p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

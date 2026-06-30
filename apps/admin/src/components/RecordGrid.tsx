import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { pullRemote, saveRecord, deleteRecord } from "@/lib/sync";
import { getMyProfile, getAvatarUrl, roleLabel } from "@/lib/profile";
import { pullAllUserGrids, type UserGrid } from "@/lib/devData";
import { TrainingGrid } from "@/components/TrainingGrid";
import { Avatar } from "@/components/Avatar";
import { RefreshButton } from "@/components/RefreshButton";
import {
  type Item,
  type Minutes,
  ymd,
  WD,
  QUICK_TIME,
  QUICK_COUNT,
} from "@/lib/training";

// ホーム（記録）。ロールで見える範囲が変わる:
//   - 一般ユーザー: 自分のデータのみ（編集可）。
//   - 管理者/開発者: 全ユーザーのデータをユーザーごとの表で表示（現在は閲覧のみ）。
export function RecordGrid() {
  const [role, setRole] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 一般ユーザー（本人）用
  const [items, setItems] = useState<Item[]>([]);
  const [minutes, setMinutes] = useState<Minutes>({});
  const [weekStart, setWeekStart] = useState<number>(1);

  // 管理者/開発者用（全ユーザー）
  const [userGrids, setUserGrids] = useState<UserGrid[]>([]);

  // セル編集モーダル（本人のみ）
  const [editing, setEditing] = useState<{ itemId: string; date: Date } | null>(
    null,
  );
  const [editVal, setEditVal] = useState("");
  const [cellBusy, setCellBusy] = useState(false);
  const [cellError, setCellError] = useState<string | null>(null);

  const isManager = role === "admin" || role === "developer";

  async function loadData() {
    setLoaded(false);
    setLoadError(null);
    try {
      if (!supabase) {
        setLoaded(true);
        return;
      }
      const p = await getMyProfile();
      const r = p?.role ?? "general";
      setRole(r);
      if (r === "admin" || r === "developer") {
        setUserGrids(await pullAllUserGrids());
      } else {
        const remote = await pullRemote();
        if (remote) {
          setItems(remote.items);
          setMinutes(remote.minutes);
          if (remote.weekStart != null) setWeekStart(remote.weekStart);
        }
      }
      setLoaded(true);
    } catch (e) {
      console.warn("[home] load failed:", e);
      setLoadError("データの読み込みに失敗しました。通信状況を確認してください。");
    }
  }
  useEffect(() => {
    loadData();
  }, []);

  function openEditor(itemId: string, d: Date) {
    const cur = minutes[`${itemId}:${ymd(d)}`] ?? 0;
    setEditing({ itemId, date: d });
    setEditVal(cur ? String(cur) : "");
    setCellError(null);
  }
  async function applyEditor() {
    if (!editing) return;
    const itemId = editing.itemId;
    const date = ymd(editing.date);
    const key = `${itemId}:${date}`;
    const v = Math.max(0, Math.round(Number(editVal) || 0));
    setCellBusy(true);
    setCellError(null);
    try {
      if (supabase) {
        if (v > 0) await saveRecord(itemId, date, v);
        else await deleteRecord(itemId, date);
      }
      setMinutes((prev) => {
        const next = { ...prev };
        if (v > 0) next[key] = v;
        else delete next[key];
        return next;
      });
      setEditing(null);
    } catch (e) {
      console.warn("[record] save failed:", e);
      setCellError("保存に失敗しました。通信状況を確認してもう一度お試しください。");
    } finally {
      setCellBusy(false);
    }
  }
  async function clearEditor() {
    if (!editing) return;
    const itemId = editing.itemId;
    const date = ymd(editing.date);
    const key = `${itemId}:${date}`;
    setCellBusy(true);
    setCellError(null);
    try {
      if (supabase) await deleteRecord(itemId, date);
      setMinutes((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setEditing(null);
    } catch (e) {
      console.warn("[record] delete failed:", e);
      setCellError("削除に失敗しました。通信状況を確認してもう一度お試しください。");
    } finally {
      setCellBusy(false);
    }
  }

  const editingItem = editing
    ? items.find((x) => x.id === editing.itemId)
    : null;

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

  // ===== 管理者/開発者: 全ユーザーをユーザーごとの表で表示（閲覧のみ）=====
  if (isManager) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[20px] font-semibold text-foreground">ホーム</h2>
          <RefreshButton onClick={loadData} />
        </div>
        <p className="mb-5 text-[13px] text-muted">
          全ユーザーの記録を表示しています（{roleLabel(role ?? "")}・閲覧専用）。
          登録ユーザー {userGrids.length} 名。
        </p>

        <div className="space-y-8">
          {userGrids.map((u) => {
            const avatarUrl = getAvatarUrl(u.avatarPath);
            const name = u.nickname?.trim() || u.email?.split("@")[0] || "（名称未設定）";
            return (
              <section key={u.id}>
                <div className="mb-2 flex items-center gap-3">
                  <Avatar url={avatarUrl} fallback={name.charAt(0).toUpperCase()} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-foreground">
                      {name}
                      <span className="ml-2 align-middle text-[12px] font-normal text-muted">
                        {roleLabel(u.role)}
                      </span>
                    </p>
                    <p className="truncate text-[12px] text-muted">
                      {u.email ?? "-"}
                    </p>
                  </div>
                </div>
                <TrainingGrid
                  items={u.items}
                  minutes={u.minutes}
                  weekStart={u.weekStart}
                  readOnly
                  maxHeight="none"
                />
              </section>
            );
          })}
          {userGrids.length === 0 && (
            <p className="py-10 text-center text-[15px] text-muted">
              ユーザーがいません。
            </p>
          )}
        </div>
      </div>
    );
  }

  // ===== 一般ユーザー: 自分のデータ（編集可）=====
  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[20px] font-semibold text-foreground">ホーム</h2>
        <RefreshButton onClick={loadData} />
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-center text-[15px] text-muted">
          種目がありません。「設定」から登録してください。
        </p>
      ) : (
        <TrainingGrid
          items={items}
          minutes={minutes}
          weekStart={weekStart}
          onCell={openEditor}
        />
      )}

      {/* セル入力モーダル */}
      {editing && editingItem && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card-bg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: editingItem.color }}
              />
              <div>
                <div className="text-[16px] font-semibold text-slate-900">
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
                className="w-full rounded-lg border border-slate-300 bg-card-bg px-3 py-2.5 text-[18px] font-semibold text-slate-900 placeholder:text-slate-400"
              />
              <span className="text-[16px] font-medium text-slate-700">
                {editingItem.unit === "time" ? "分" : "回"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(editingItem.unit === "time" ? QUICK_TIME : QUICK_COUNT).map(
                (m) => (
                  <button
                    key={m}
                    onClick={() => setEditVal(String(m))}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-[15px] font-medium text-slate-800 hover:bg-slate-200"
                  >
                    {m}
                    {editingItem.unit === "time" ? "分" : "回"}
                  </button>
                ),
              )}
            </div>

            {cellError && (
              <p className="mt-4 text-[14px] font-medium text-red-600">
                {cellError}
              </p>
            )}

            <button
              onClick={applyEditor}
              disabled={cellBusy}
              className="mt-5 w-full rounded-xl bg-accent px-4 py-2.5 text-[16px] font-semibold text-white active:opacity-90 disabled:opacity-50"
            >
              {cellBusy ? "保存中…" : "保存"}
            </button>
            <div className="mt-2 flex gap-2">
              <button
                onClick={clearEditor}
                disabled={cellBusy}
                className="flex-1 rounded-xl border border-slate-300 bg-card-bg px-4 py-2.5 text-[16px] font-medium text-slate-800 disabled:opacity-50"
              >
                クリア
              </button>
              <button
                onClick={() => setEditing(null)}
                disabled={cellBusy}
                className="flex-1 rounded-xl border border-slate-300 bg-card-bg px-4 py-2.5 text-[16px] font-medium text-slate-800 disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

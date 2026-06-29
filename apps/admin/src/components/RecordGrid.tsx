import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { pullRemote, saveRecord, deleteRecord } from "@/lib/sync";
import {
  type Item,
  type Minutes,
  ymd,
  addDays,
  startOfDay,
  fmtHours,
  WD,
  GRID_PAST_DAYS,
  QUICK_TIME,
  QUICK_COUNT,
} from "@/lib/training";

const NAME_W = 140; // 種目名カラム幅(px)
const CELL_W = 48; // 1日セル幅(px)

// 記録グリッド（デスクトップ）。Supabaseが正本・保存はその場で書き込み。
export function RecordGrid() {
  const [items, setItems] = useState<Item[]>([]);
  const [minutes, setMinutes] = useState<Minutes>({});
  const [weekStart, setWeekStart] = useState<number>(1);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<{ itemId: string; date: Date } | null>(
    null,
  );
  const [editVal, setEditVal] = useState("");
  const [cellBusy, setCellBusy] = useState(false);
  const [cellError, setCellError] = useState<string | null>(null);

  const gridScrollRef = useRef<HTMLDivElement>(null);

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
      setLoaded(true);
    } catch (e) {
      console.warn("[load] failed:", e);
      setLoadError("データの読み込みに失敗しました。通信状況を確認してください。");
    }
  }
  useEffect(() => {
    loadData();
  }, []);

  // 開いた時・「今日へ」で右端へ
  const scrollToEnd = () => {
    if (gridScrollRef.current)
      gridScrollRef.current.scrollLeft = gridScrollRef.current.scrollWidth;
  };
  useEffect(() => {
    if (loaded) scrollToEnd();
  }, [loaded]);

  const todayStr = ymd(new Date());
  const today = startOfDay(new Date());

  // 表示範囲：最古の記録日〜今日（最大 GRID_PAST_DAYS 日前まで）
  const recYmds = Object.keys(minutes).map((k) => k.slice(k.indexOf(":") + 1));
  const firstYmd = recYmds.length
    ? recYmds.reduce((a, b) => (a < b ? a : b))
    : todayStr;
  const [fy, fm, fd] = firstYmd.split("-").map(Number);
  let gStart = new Date(fy, fm - 1, fd);
  const gMinStart = addDays(today, -GRID_PAST_DAYS);
  if (gStart.getTime() < gMinStart.getTime()) gStart = gMinStart;
  const gCount =
    Math.round((today.getTime() - gStart.getTime()) / 86400000) + 1;
  const gridDays = Array.from({ length: gCount }, (_, i) => addDays(gStart, i));

  function recent7(itemId: string) {
    let m = 0;
    for (let k = 0; k < 7; k++) {
      m += minutes[`${itemId}:${ymd(addDays(today, -k))}`] ?? 0;
    }
    return m;
  }

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

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[20px] font-semibold text-foreground">ホーム</h2>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="rounded-lg border border-slate-300 bg-card-bg px-3 py-1.5 text-[14px] font-medium text-slate-700 hover:bg-slate-50"
          >
            更新
          </button>
          <button
            onClick={scrollToEnd}
            className="rounded-lg border border-slate-300 bg-card-bg px-3 py-1.5 text-[14px] font-medium text-slate-700 hover:bg-slate-50"
          >
            今日へ
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-center text-[15px] text-muted">
          種目がありません。「設定」から登録してください。
        </p>
      ) : (
        <div
          ref={gridScrollRef}
          className="overflow-auto rounded-2xl border border-card-border bg-card-bg"
          style={{ maxHeight: "calc(100dvh - 160px)" }}
        >
          <div style={{ minWidth: NAME_W + gridDays.length * CELL_W }}>
            {/* 日付ヘッダー（縦スクロールで上端固定） */}
            <div className="sticky top-0 z-30 flex items-stretch border-b border-card-border bg-card-bg">
              <div
                className="sticky left-0 z-40 flex items-center border-r border-card-border bg-card-bg px-3 py-2 text-[15px] font-semibold text-slate-700"
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
                      isWeekStart ? "border-l border-slate-300" : ""
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
                        isToday ? "bg-accent text-white" : "text-slate-800"
                      }`}
                    >
                      {isFirst ? `${d.getMonth() + 1}/1` : d.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 種目行 */}
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-stretch border-b border-slate-100 last:border-b-0"
              >
                <div
                  className="sticky left-0 z-10 flex items-center gap-2 border-r border-card-border bg-card-bg px-3 py-2"
                  style={{ width: NAME_W }}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: it.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-slate-900">
                      {it.name}
                    </span>
                    <span className="block text-[12px] text-muted">
                      7日{" "}
                      {it.unit === "time"
                        ? `${fmtHours(recent7(it.id))}h`
                        : `${recent7(it.id)}回`}
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
                      className={`flex h-12 shrink-0 items-center justify-center hover:bg-slate-50 ${
                        isWeekStart ? "border-l border-slate-300" : ""
                      }`}
                      style={{ width: CELL_W }}
                    >
                      <span
                        className="flex h-8 min-w-8 items-center justify-center rounded-lg px-1 text-[13px] font-semibold"
                        style={
                          val > 0
                            ? { backgroundColor: it.color, color: "#fff" }
                            : { color: "#cbd5e1" }
                        }
                      >
                        {val > 0 ? val : "·"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
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

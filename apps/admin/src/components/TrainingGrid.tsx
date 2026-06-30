import { useEffect, useRef } from "react";
import {
  type Item,
  type Minutes,
  ymd,
  addDays,
  startOfDay,
  fmtHours,
  WD,
  GRID_PAST_DAYS,
} from "@/lib/training";

const NAME_W = 140; // 種目名カラム幅(px)
const CELL_W = 48; // 1日セル幅(px)

// 記録グリッドの表示部品（データ取得はしない）。
// readOnly=false のときはセルがボタンになり onCell(itemId, date) を呼ぶ。
export function TrainingGrid({
  items,
  minutes,
  weekStart,
  readOnly = false,
  onCell,
  maxHeight = "calc(100dvh - 220px)",
}: {
  items: Item[];
  minutes: Minutes;
  weekStart: number;
  readOnly?: boolean;
  onCell?: (itemId: string, date: Date) => void;
  maxHeight?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = startOfDay(new Date());
  const todayStr = ymd(today);

  // 表示範囲：約 GRID_PAST_DAYS 日前〜今日（mobile と同じ。過去入力できるよう広く取る）。
  // 記録がそれより古ければ最古の記録日まで遡る。
  const recYmds = Object.keys(minutes).map((k) => k.slice(k.indexOf(":") + 1));
  const firstYmd = recYmds.length
    ? recYmds.reduce((a, b) => (a < b ? a : b))
    : todayStr;
  const [fy, fm, fd] = firstYmd.split("-").map(Number);
  let gStart = new Date(fy, fm - 1, fd);
  const gMinStart = addDays(today, -GRID_PAST_DAYS);
  if (gStart.getTime() > gMinStart.getTime()) gStart = gMinStart;
  const gCount =
    Math.round((today.getTime() - gStart.getTime()) / 86400000) + 1;
  const gridDays = Array.from({ length: gCount }, (_, i) => addDays(gStart, i));

  // 連続する同月の列をまとめた「月バンド」用セグメント（カレンダー風の月見出し）
  const monthSegments: { key: string; label: string; count: number }[] = [];
  for (const d of gridDays) {
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const last = monthSegments[monthSegments.length - 1];
    if (last && last.key === key) last.count += 1;
    else monthSegments.push({ key, label: `${d.getMonth() + 1}月`, count: 1 });
  }

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, []);

  function recent7(itemId: string) {
    let m = 0;
    for (let k = 0; k < 7; k++) {
      m += minutes[`${itemId}:${ymd(addDays(today, -k))}`] ?? 0;
    }
    return m;
  }

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-card-border bg-card-bg px-4 py-5 text-center text-[14px] text-muted">
        登録項目はありません。
      </p>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="overflow-auto overscroll-none rounded-2xl border border-card-border bg-card-bg"
      style={{ maxHeight }}
    >
      <div style={{ minWidth: NAME_W + gridDays.length * CELL_W }}>
        {/* 日付ヘッダー（縦スクロールで上端固定）。月バンド＋曜日/日の2段。 */}
        <div className="sticky top-0 z-30 bg-card-bg">
          {/* 月バンド（横スクロールしても見えている月のラベルは左に残る） */}
          <div className="flex items-stretch">
            <div
              className="sticky left-0 z-40 bg-card-bg"
              style={{ width: NAME_W }}
            />
            {monthSegments.map((seg) => (
              <div
                key={seg.key}
                className="shrink-0 border-l border-slate-200 py-1 first:border-l-0"
                style={{ width: seg.count * CELL_W }}
              >
                <span
                  className="sticky inline-block px-1.5 text-[12px] font-semibold text-muted"
                  style={{ left: NAME_W }}
                >
                  {seg.label}
                </span>
              </div>
            ))}
          </div>
          {/* 曜日 + 日 */}
          <div className="flex items-stretch border-b border-card-border">
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
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
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
              const cellInner = (
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
              );
              const cls = `flex h-12 shrink-0 items-center justify-center ${
                isWeekStart ? "border-l border-slate-300" : ""
              }`;
              return readOnly ? (
                <div key={i} className={cls} style={{ width: CELL_W }}>
                  {cellInner}
                </div>
              ) : (
                <button
                  key={i}
                  onClick={() => onCell?.(it.id, d)}
                  className={`${cls} hover:bg-slate-50`}
                  style={{ width: CELL_W }}
                >
                  {cellInner}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

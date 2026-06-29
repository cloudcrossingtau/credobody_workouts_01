import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { supabase } from "@/lib/supabase";
import { pullRemote } from "@/lib/sync";
import {
  type Item,
  type Minutes,
  ymd,
  addDays,
  startOfDay,
  startOfWeek,
  niceScale,
  WD,
  TIME_COLOR,
  COUNT_COLOR,
} from "@/lib/training";

const CHART_H = 200; // 描画領域の高さ(px)
const AXIS_W = 40; // y軸ラベル幅(px)
const DAY_W = 44; // 日別バー幅(px)
const WEEK_W = 64; // 週別バー幅(px)

export function Charts() {
  const [items, setItems] = useState<Item[]>([]);
  const [minutes, setMinutes] = useState<Minutes>({});
  const [weekStart, setWeekStart] = useState<number>(1);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const timeDailyRef = useRef<HTMLDivElement>(null);
  const timeWeeklyRef = useRef<HTMLDivElement>(null);
  const countDailyRef = useRef<HTMLDivElement>(null);
  const countWeeklyRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!loaded) return;
    const toEnd = (r: RefObject<HTMLDivElement>) => {
      if (r.current) r.current.scrollLeft = r.current.scrollWidth;
    };
    toEnd(timeDailyRef);
    toEnd(timeWeeklyRef);
    toEnd(countDailyRef);
    toEnd(countWeeklyRef);
  }, [loaded]);

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

  const today = startOfDay(new Date());
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
            wd === 0 ? "text-red-500" : wd === 6 ? "text-blue-500" : "text-muted"
          }`}
        >
          {isFirst ? `${d.getMonth() + 1}/1` : d.getDate()}
        </div>
        <div className="text-[11px] text-slate-500">{WD[wd]}</div>
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

  const fmtMin = (v: number) => `${Math.round(v)}`;
  const fmtC = (v: number) => `${v}`;

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
      <div className="mt-3 flex items-start rounded-2xl border border-card-border bg-card-bg p-3">
        <div className="relative shrink-0" style={{ width: AXIS_W, height: CHART_H }}>
          {ticks.map((t, i) => (
            <div
              key={i}
              className="absolute right-1 -translate-y-1/2 text-right text-[11px] text-slate-500"
              style={{ top: `${(1 - t / scale.max) * 100}%` }}
            >
              {fmt(t)}
            </div>
          ))}
        </div>
        <div ref={scrollRef} className="flex-1 overflow-x-auto">
          <div style={{ minWidth: cols.length * barW }}>
            <div className="relative" style={{ height: CHART_H }}>
              {ticks.map((t, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 -translate-y-1/2 border-t border-slate-100"
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
                      <span className="text-[11px] font-semibold text-slate-700">
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
    <div className="mx-auto max-w-5xl p-6">
      <h2 className="mb-4 text-[20px] font-semibold text-foreground">グラフ</h2>

      {items.length === 0 && (
        <p className="mt-6 text-center text-[15px] text-muted">
          種目がありません。「設定」から登録してください。
        </p>
      )}

      {timeItems.length > 0 && (
        <>
          <section className="mt-5">
            <h3 className="text-[16px] font-semibold text-slate-900">
              時間（分）・日別
            </h3>
            {renderBarChart(
              dayList.map((d) => ({ value: sumDay(timeItems, d), x: dailyX(d) })),
              TIME_COLOR,
              fmtMin,
              DAY_W,
              timeDailyRef,
            )}
          </section>
          <section className="mt-6">
            <h3 className="text-[16px] font-semibold text-slate-900">
              時間（分）・週別
            </h3>
            {renderBarChart(
              weekList.map((ws) => ({
                value: sumWeek(timeItems, ws),
                x: weeklyX(ws),
              })),
              TIME_COLOR,
              fmtMin,
              WEEK_W,
              timeWeeklyRef,
            )}
          </section>
        </>
      )}

      {countItems.length > 0 && (
        <>
          <section className="mt-7">
            <h3 className="text-[16px] font-semibold text-slate-900">
              種目数（回）・日別
            </h3>
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
            <h3 className="text-[16px] font-semibold text-slate-900">
              種目数（回）・週別
            </h3>
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
    </div>
  );
}

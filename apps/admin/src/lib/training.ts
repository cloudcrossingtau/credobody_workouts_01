// トレーニング記録の共有ロジック（型・日付ユーティリティ・目盛り・デモ生成）。
// 記録/グラフ/設定の各ページから参照する。mobile-web の HabitCalendar 内の
// 同等ロジックを admin（デスクトップ）向けに切り出したもの。

export type Unit = "time" | "count"; // time=実施時間(分) / count=種目数(回)
export type Item = { id: string; name: string; color: string; unit: Unit };
// key = `${itemId}:${YYYY-MM-DD}` -> 値（time: 分 / count: 回）
export type Minutes = Record<string, number>;

// ---- 日付ユーティリティ ----
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function startOfWeek(d: Date, weekStart: number): Date {
  const x = startOfDay(d);
  const diff = (x.getDay() - weekStart + 7) % 7;
  return addDays(x, -diff);
}
export const WD = ["日", "月", "火", "水", "木", "金", "土"];

// 分 -> 時間（合計表示）
export function fmtHours(min: number): string {
  const h = min / 60;
  return Number.isInteger(h) ? `${h}` : h.toFixed(1);
}

// 数値の見やすい目盛り
export function niceScale(maxVal: number): { max: number; step: number } {
  if (maxVal <= 0) return { max: 1, step: 1 };
  const rough = maxVal / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const cand = [1, 2, 2.5, 5, 10].map((c) => c * pow);
  const step = cand.find((c) => c >= rough) ?? 10 * pow;
  return { max: Math.ceil(maxVal / step) * step, step };
}

export const COLOR_CHOICES = [
  "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6",
];

// デモ用の既定項目（項目が無い時の投入に使用）
export const SEED_ITEMS: Item[] = [
  { id: "i1", name: "ラン", color: "#3b82f6", unit: "time" },
  { id: "i2", name: "バイク", color: "#06b6d4", unit: "time" },
  { id: "i3", name: "脚", color: "#10b981", unit: "count" },
  { id: "i4", name: "腕", color: "#f59e0b", unit: "count" },
  { id: "i5", name: "腹筋", color: "#ef4444", unit: "count" },
  { id: "i6", name: "背筋", color: "#8b5cf6", unit: "count" },
];

// デモ用データ生成（過去42日ぶん。項目ごとに曜日パターンで実施）
export function seedMinutes(list: Item[]): Minutes {
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

// グラフ色（単色）
export const TIME_COLOR = "#2563eb"; // 時間（分）= 青
export const COUNT_COLOR = "#10b981"; // 種目数（回）= 緑

// グリッドで遡れる日数（最大スクロール範囲）
export const GRID_PAST_DAYS = 180;
export const QUICK_TIME = [15, 30, 45, 60, 90];
export const QUICK_COUNT = [1, 2, 3, 4, 5];

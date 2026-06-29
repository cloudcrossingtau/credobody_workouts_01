import { supabase } from "./supabase";
import type { Unit } from "./training";

// 開発者専用: 全ユーザーのトレーニングデータをまとめて取得する。
// RLS により developer は training_items / training_records を全件、
// profiles も is_admin(=admin/developer) で全件参照できる。
// 一般ユーザーが呼んでも RLS で自分の分だけになる（ページ自体は開発者限定）。

export type UserItem = {
  id: string;
  name: string;
  color: string;
  unit: Unit;
  // 集計（閲覧用）
  total7: number; // 直近7日合計（生値）
  totalAll: number; // 全期間合計（生値）
  count: number; // 記録日数
  lastDate: string | null; // 最終記録日 YYYY-MM-DD
};

export type UserData = {
  id: string;
  email: string | null;
  nickname: string | null;
  avatarPath: string | null;
  role: string;
  items: UserItem[];
  recordCount: number; // そのユーザーの総記録数
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function pullAllUsers(): Promise<UserData[]> {
  if (!supabase) return [];

  const [{ data: profs, error: ep }, { data: items, error: ei }, { data: recs, error: er }] =
    await Promise.all([
      supabase.from("profiles").select("id,email,nickname,avatar_path,role"),
      supabase
        .from("training_items")
        .select("id,user_id,name,color,unit,sort_order")
        .order("sort_order", { ascending: true }),
      supabase.from("training_records").select("user_id,item_id,date,value"),
    ]);
  if (ep) throw ep;
  if (ei) throw ei;
  if (er) throw er;

  // 直近7日の下限日
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from7 = new Date(today);
  from7.setDate(from7.getDate() - 6);
  const from7Str = ymd(from7);

  // item_id -> 集計
  const agg = new Map<
    string,
    { total7: number; totalAll: number; count: number; lastDate: string | null }
  >();
  const recCountByUser = new Map<string, number>();
  for (const r of recs ?? []) {
    const a =
      agg.get(r.item_id) ?? { total7: 0, totalAll: 0, count: 0, lastDate: null };
    a.totalAll += r.value;
    a.count += 1;
    if (r.date >= from7Str) a.total7 += r.value;
    if (!a.lastDate || r.date > a.lastDate) a.lastDate = r.date;
    agg.set(r.item_id, a);
    recCountByUser.set(r.user_id, (recCountByUser.get(r.user_id) ?? 0) + 1);
  }

  // user_id -> items
  const itemsByUser = new Map<string, UserItem[]>();
  for (const it of items ?? []) {
    const a = agg.get(it.id) ?? {
      total7: 0,
      totalAll: 0,
      count: 0,
      lastDate: null,
    };
    const list = itemsByUser.get(it.user_id) ?? [];
    list.push({
      id: it.id,
      name: it.name,
      color: it.color,
      unit: it.unit,
      total7: a.total7,
      totalAll: a.totalAll,
      count: a.count,
      lastDate: a.lastDate,
    });
    itemsByUser.set(it.user_id, list);
  }

  const users: UserData[] = (profs ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    nickname: p.nickname,
    avatarPath: p.avatar_path,
    role: p.role,
    items: itemsByUser.get(p.id) ?? [],
    recordCount: recCountByUser.get(p.id) ?? 0,
  }));

  // 記録が多い順 → 名前順で並べる（活発なユーザーを上に）
  users.sort((a, b) => {
    if (b.recordCount !== a.recordCount) return b.recordCount - a.recordCount;
    return (a.nickname || a.email || "").localeCompare(b.nickname || b.email || "");
  });
  return users;
}

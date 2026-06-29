import { supabase } from "./supabase";

// Supabase が唯一の正（source of truth）。普通のWebアプリと同じく、
// 各操作はその場で Supabase に書き込み、成功/失敗を呼び出し側で扱う。
// localStorage は記録の保存には使わない（マルチ端末対応・二重管理の排除）。

export type Unit = "time" | "count";
export type SyncItem = { id: string; name: string; color: string; unit: Unit };
export type RemoteState = {
  items: SyncItem[];
  minutes: Record<string, number>;
  weekStart: number | null;
};

// crypto.randomUUID は secure context 限定なのでフォールバック付き
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// key = `${itemId}:${YYYY-MM-DD}`（itemId は uuid。コロンを含まない）
function splitKey(k: string): [string, string] {
  const i = k.indexOf(":");
  return [k.slice(0, i), k.slice(i + 1)];
}

async function requireUserId(): Promise<string> {
  if (!supabase) throw new Error("Supabase 未設定");
  // getSession はローカル(localStorage)から即取得（通信なし）。getUser はサーバー検証で
  // 往復が発生するため、保存のたびに遅くなる。本人判定はRLSがサーバー側で強制するので、
  // user_id はローカルの値で十分・安全。
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) throw new Error("未ログイン");
  return uid;
}

// ---- 読み込み（起動時） ----
// リモートの全データを取得。未ログイン/未設定なら null。
export async function pullRemote(): Promise<RemoteState | null> {
  if (!supabase) return null;
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user?.id;
  if (!uid) return null;

  const { data: itemRows, error: e1 } = await supabase
    .from("training_items")
    .select("id,name,color,unit,sort_order")
    .eq("user_id", uid) // 本人のデータのみ（開発者でも個人タブは本人分だけに限定）
    .order("sort_order", { ascending: true });
  if (e1) throw e1;
  const items: SyncItem[] = (itemRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    unit: r.unit,
  }));

  const { data: recRows, error: e2 } = await supabase
    .from("training_records")
    .select("item_id,date,value")
    .eq("user_id", uid); // 本人のデータのみ
  if (e2) throw e2;
  const minutes: Record<string, number> = {};
  for (const r of recRows ?? []) minutes[`${r.item_id}:${r.date}`] = r.value;

  const { data: prof } = await supabase
    .from("profiles")
    .select("week_start")
    .eq("id", uid)
    .single();

  return { items, minutes, weekStart: prof?.week_start ?? null };
}

// ---- 記録（1件ずつ即時保存） ----
// 値>0 を1件保存（同じ item_id+date があれば上書き）。
export async function saveRecord(
  itemId: string,
  date: string,
  value: number,
): Promise<void> {
  const uid = await requireUserId();
  const { error } = await supabase!
    .from("training_records")
    .upsert(
      { user_id: uid, item_id: itemId, date, value },
      { onConflict: "user_id,item_id,date" },
    );
  if (error) throw error;
}

// 記録を1件削除（値0＝未入力）。
export async function deleteRecord(
  itemId: string,
  date: string,
): Promise<void> {
  const uid = await requireUserId();
  const { error } = await supabase!
    .from("training_records")
    .delete()
    .eq("user_id", uid)
    .eq("item_id", itemId)
    .eq("date", date);
  if (error) throw error;
}

// ---- 項目（設定の「保存」でまとめて反映） ----
// 現在の項目一覧を正として、upsert＋一覧に無い項目をdelete（子の記録はCASCADE削除）。
export async function saveItems(items: SyncItem[]): Promise<void> {
  const uid = await requireUserId();

  const { data: remoteItems, error: e1 } = await supabase!
    .from("training_items")
    .select("id")
    .eq("user_id", uid); // 本人の項目のみ対象（他人の項目を消さない/書き換えない）
  if (e1) throw e1;
  const localIds = new Set(items.map((i) => i.id));
  const delIds = (remoteItems ?? [])
    .map((r) => r.id)
    .filter((id) => !localIds.has(id));
  if (delIds.length) {
    const { error } = await supabase!
      .from("training_items")
      .delete()
      .in("id", delIds);
    if (error) throw error;
  }
  if (items.length) {
    const rows = items.map((it, i) => ({
      id: it.id,
      user_id: uid,
      name: it.name,
      color: it.color,
      unit: it.unit,
      sort_order: i,
    }));
    const { error } = await supabase!.from("training_items").upsert(rows);
    if (error) throw error;
  }
}

// ---- 週開始曜日 ----
export async function saveWeekStart(weekStart: number): Promise<void> {
  const uid = await requireUserId();
  const { error } = await supabase!
    .from("profiles")
    .update({ week_start: weekStart })
    .eq("id", uid);
  if (error) throw error;
}

// ---- データ管理（デモ投入／全削除） ----
export async function deleteAllRecords(): Promise<void> {
  const uid = await requireUserId();
  const { error } = await supabase!
    .from("training_records")
    .delete()
    .eq("user_id", uid);
  if (error) throw error;
}

// 全記録を minutes の内容で置き換える（デモ投入用）。
export async function replaceAllRecords(
  minutes: Record<string, number>,
): Promise<void> {
  const uid = await requireUserId();
  await deleteAllRecords();
  const rows = Object.keys(minutes).map((k) => {
    const [itemId, date] = splitKey(k);
    return { user_id: uid, item_id: itemId, date, value: minutes[k] };
  });
  if (rows.length) {
    const { error } = await supabase!.from("training_records").insert(rows);
    if (error) throw error;
  }
}

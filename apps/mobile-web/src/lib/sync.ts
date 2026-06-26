import { supabase } from "./supabase";

// ローカル⇔Supabase 同期。
// 方針: ローカル(localStorage)を正として、ログイン中はSupabaseへミラー保存する。
//   - 初回ログイン時: リモートにデータがあれば採用、無ければローカルをアップロード。
//   - 以降: ローカル変更を Supabase に reconcile（upsert＋不要行delete）。
// 破壊的削除はあるが、必ず「ローカル＝正」を前提に呼ぶこと（空ローカルでは呼ばない）。

export type Unit = "time" | "count";
export type SyncItem = { id: string; name: string; color: string; unit: Unit };
export type SyncState = {
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

// key = `${itemId}:${YYYY-MM-DD}`（itemId は uuid または旧文字列。どちらもコロンを含まない）
function splitKey(k: string): [string, string] {
  const i = k.indexOf(":");
  return [k.slice(0, i), k.slice(i + 1)];
}

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// リモートの全データを取得。未ログイン/未設定なら null。
export async function pullRemote(): Promise<SyncState | null> {
  if (!supabase) return null;
  const uid = await currentUserId();
  if (!uid) return null;

  const { data: itemRows, error: e1 } = await supabase
    .from("training_items")
    .select("id,name,color,unit,sort_order")
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
    .select("item_id,date,value");
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

// ローカルの項目IDをuuidに振り直す（初回アップロード前。旧 "i1" 等を uuid 化）
export function remapLocalIds(
  items: SyncItem[],
  minutes: Record<string, number>,
): { items: SyncItem[]; minutes: Record<string, number> } {
  const map = new Map<string, string>();
  const newItems = items.map((it) => {
    const nid = uuid();
    map.set(it.id, nid);
    return { ...it, id: nid };
  });
  const newMinutes: Record<string, number> = {};
  for (const k of Object.keys(minutes)) {
    const [oldId, date] = splitKey(k);
    const nid = map.get(oldId);
    if (nid) newMinutes[`${nid}:${date}`] = minutes[k];
  }
  return { items: newItems, minutes: newMinutes };
}

// ローカル状態をリモートへ反映（ローカル＝正）。
export async function reconcileToRemote(
  items: SyncItem[],
  minutes: Record<string, number>,
  weekStart: number,
): Promise<void> {
  if (!supabase) return;
  const uid = await currentUserId();
  if (!uid) return;

  // ---- 項目 ----
  const { data: remoteItems, error: ei } = await supabase
    .from("training_items")
    .select("id");
  if (ei) throw ei;
  const localItemIds = new Set(items.map((i) => i.id));
  const delItemIds = (remoteItems ?? [])
    .map((r) => r.id)
    .filter((id) => !localItemIds.has(id));
  if (delItemIds.length) {
    const { error } = await supabase
      .from("training_items")
      .delete()
      .in("id", delItemIds); // 子の records は ON DELETE CASCADE
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
    const { error } = await supabase.from("training_items").upsert(rows);
    if (error) throw error;
  }

  // ---- 記録 ----
  const { data: remoteRecs, error: er } = await supabase
    .from("training_records")
    .select("id,item_id,date");
  if (er) throw er;
  const localKeys = new Set(Object.keys(minutes));
  const delRecIds = (remoteRecs ?? [])
    .filter((r) => !localKeys.has(`${r.item_id}:${r.date}`))
    .map((r) => r.id);
  if (delRecIds.length) {
    const { error } = await supabase
      .from("training_records")
      .delete()
      .in("id", delRecIds);
    if (error) throw error;
  }
  const recRows = Object.keys(minutes).map((k) => {
    const [itemId, date] = splitKey(k);
    return { user_id: uid, item_id: itemId, date, value: minutes[k] };
  });
  if (recRows.length) {
    const { error } = await supabase
      .from("training_records")
      .upsert(recRows, { onConflict: "user_id,item_id,date" });
    if (error) throw error;
  }

  // ---- 週開始曜日 ----
  await supabase.from("profiles").update({ week_start: weekStart }).eq("id", uid);
}

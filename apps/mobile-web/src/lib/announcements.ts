import { supabase } from "./supabase";
import { withTimeout } from "./recover";

// supabase 呼び出しにタイムアウトを付ける（stale 接続で無言で固まる事象対策）。
const to = <T>(p: PromiseLike<T>): Promise<T> =>
  withTimeout(() => Promise.resolve(p), 8000, "announcements");

export interface Announcement {
  id: string;
  title: string;
  body: string;
  is_published: boolean;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS = "id, title, body, is_published, ends_at, created_at, updated_at";

// 一般ユーザー向け: 公開中かつ未終了のものを作成日降順で取得（RLS で絞られる）。
export async function listActiveAnnouncements(): Promise<Announcement[]> {
  if (!supabase) return [];
  const { data, error } = await to(
    supabase
      .from("announcements")
      .select(COLUMNS)
      .order("created_at", { ascending: false }),
  );
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

// 現在ユーザーが既読にしている announcement_id の集合（未ログイン時は空）。
export async function fetchMyReadAnnouncementIds(): Promise<Set<string>> {
  if (!supabase) return new Set();
  const { data: userData } = await to(supabase.auth.getUser());
  const userId = userData.user?.id;
  if (!userId) return new Set();
  const { data, error } = await to(
    supabase
      .from("announcement_reads")
      .select("announcement_id")
      .eq("user_id", userId),
  );
  if (error) throw error;
  return new Set(
    (data ?? []).map((r) => (r as { announcement_id: string }).announcement_id),
  );
}

// 渡された announcement ID 群を一括で既読化する（重複は upsert で無視）。
export async function markAnnouncementsRead(
  announcementIds: string[],
): Promise<void> {
  if (!supabase || announcementIds.length === 0) return;
  const { data: userData } = await to(supabase.auth.getUser());
  const userId = userData.user?.id;
  if (!userId) return;
  const rows = announcementIds.map((id) => ({
    user_id: userId,
    announcement_id: id,
  }));
  const { error } = await to(
    supabase.from("announcement_reads").upsert(rows, {
      onConflict: "user_id,announcement_id",
      ignoreDuplicates: true,
    }),
  );
  if (error) throw error;
}

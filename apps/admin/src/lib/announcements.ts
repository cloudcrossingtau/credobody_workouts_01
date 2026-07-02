import { supabase } from "./supabase";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  is_published: boolean;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  "id, title, body, is_published, ends_at, created_by, created_at, updated_at";

// 管理画面用: 下書きを含む全件を作成日降順で取得（RLS により管理者のみ全件）。
export async function listAllAnnouncements(): Promise<Announcement[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("announcements")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

export async function createAnnouncement(params: {
  title: string;
  body: string;
  isPublished: boolean;
  endsAt: string | null;
}): Promise<Announcement> {
  if (!supabase) throw new Error("Supabase 未設定");
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      title: params.title,
      body: params.body,
      is_published: params.isPublished,
      ends_at: params.endsAt,
      created_by: userId,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as Announcement;
}

export async function updateAnnouncement(
  id: string,
  params: {
    title: string;
    body: string;
    isPublished: boolean;
    endsAt: string | null;
  },
): Promise<Announcement> {
  if (!supabase) throw new Error("Supabase 未設定");
  const { data, error } = await supabase
    .from("announcements")
    .update({
      title: params.title,
      body: params.body,
      is_published: params.isPublished,
      ends_at: params.endsAt,
    })
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as Announcement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase 未設定");
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}

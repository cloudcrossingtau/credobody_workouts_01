import { supabase } from "./supabase";

// 開発者向けのユーザー管理。RLS: developer は profiles を全件参照（is_admin）・更新可。
export type Role = "general" | "admin" | "developer" | "trainer";
export const ROLES: Role[] = ["general", "admin", "developer", "trainer"];

export type AdminUser = {
  id: string;
  email: string | null;
  nickname: string | null;
  avatarPath: string | null;
  role: Role;
  createdAt: string | null;
};

export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function listAllUsers(): Promise<AdminUser[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,nickname,avatar_path,role,created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    nickname: p.nickname,
    avatarPath: p.avatar_path,
    role: p.role,
    createdAt: p.created_at,
  }));
}

export async function updateUserRole(id: string, role: Role): Promise<void> {
  if (!supabase) throw new Error("Supabase 未設定");
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) throw error;
}

// ユーザーをアカウントごと完全削除する（開発者のみ）。
// service_role が必要なので Edge Function delete-user 経由で実行する。
// DB（profiles/training_items/training_records）は auth.users の CASCADE で連動削除。
export async function deleteUser(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase 未設定");
  const { error } = await supabase.functions.invoke("delete-user", {
    body: { user_id: id },
  });
  if (error) {
    // Edge Function が返した JSON の error メッセージを拾う
    let detail = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const b = await ctx.json();
        if (b?.error) detail = b.error;
      } catch {
        /* JSON でなければ message のまま */
      }
    }
    throw new Error(detail);
  }
}

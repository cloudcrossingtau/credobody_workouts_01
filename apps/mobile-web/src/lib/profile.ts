import { supabase } from "./supabase";

// crypto.randomUUID はセキュアコンテキスト(HTTPS/localhost)限定。
// 実機の平文HTTP(LAN IP)でも動くようフォールバックを用意。
function uuid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type Profile = {
  id: string;
  email: string | null;
  role: string;
  nickname: string | null;
  avatar_path: string | null;
  week_start: number;
  last_active_at: string | null;
};

const COLUMNS =
  "id, email, role, nickname, avatar_path, week_start, last_active_at";

// 自分の last_active_at を now() に更新する（heartbeat）。装飾用途なので失敗は無視。
export async function touchMyLastActiveAt(): Promise<void> {
  if (!supabase) return;
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return;
  await supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", uid);
}

export async function getMyProfile(): Promise<Profile | null> {
  if (!supabase) return null;
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select(COLUMNS)
    .eq("id", uid)
    .single();
  if (error) return null;
  return data as Profile;
}

export async function updateMyProfile(patch: {
  nickname?: string | null;
  avatar_path?: string | null;
}): Promise<void> {
  if (!supabase) return;
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return;
  const { error } = await supabase.from("profiles").update(patch).eq("id", uid);
  if (error) throw error;
}

// 画像を最大 size px に縮小して PNG Blob を返す（容量と表示の安定のため）
export async function resizeImage(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas not supported");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("画像の変換に失敗しました"))),
      "image/png",
    ),
  );
}

export async function uploadAvatar(blob: Blob): Promise<string> {
  if (!supabase) throw new Error("Supabase 未設定");
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("未ログイン");
  const path = `${uid}/${uuid()}.png`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { upsert: false, contentType: "image/png" });
  if (error) throw error;
  return path;
}

export async function removeAvatar(path: string): Promise<void> {
  if (!supabase) return;
  await supabase.storage.from("avatars").remove([path]);
}

export function getAvatarUrl(path: string | null): string | null {
  if (!supabase || !path) return null;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

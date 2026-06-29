import { useEffect, useRef, useState } from "react";
import {
  getMyProfile,
  updateMyProfile,
  uploadAvatar,
  removeAvatar,
  getAvatarUrl,
  resizeImage,
  roleLabel,
  type Profile,
} from "@/lib/profile";

function BackHeader({ title }: { title: string }) {
  return (
    <div className="mb-5 flex items-center gap-2">
      <a
        href="/settings"
        className="rounded-lg px-2 py-1 text-[15px] text-accent hover:bg-slate-100"
      >
        ‹ 設定
      </a>
      <h2 className="text-[20px] font-semibold text-foreground">{title}</h2>
    </div>
  );
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMyProfile().then((p) => {
      setProfile(p);
      setNickname(p?.nickname ?? "");
    });
  }, []);

  async function saveNickname() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await updateMyProfile({ nickname: nickname.trim() || null });
      setProfile((p) => (p ? { ...p, nickname: nickname.trim() || null } : p));
      setMsg("保存しました。");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file || !profile) return;
    setAvatarBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const blob = await resizeImage(file, 256);
      const newPath = await uploadAvatar(blob);
      await updateMyProfile({ avatar_path: newPath });
      const old = profile.avatar_path;
      setProfile({ ...profile, avatar_path: newPath });
      if (old) await removeAvatar(old).catch(() => {});
    } catch (e) {
      setErr(e instanceof Error ? e.message : "画像のアップロードに失敗しました。");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function clearAvatar() {
    if (!profile?.avatar_path) return;
    setAvatarBusy(true);
    setErr(null);
    try {
      const old = profile.avatar_path;
      await updateMyProfile({ avatar_path: null });
      setProfile({ ...profile, avatar_path: null });
      await removeAvatar(old).catch(() => {});
    } catch (e) {
      setErr(e instanceof Error ? e.message : "削除に失敗しました。");
    } finally {
      setAvatarBusy(false);
    }
  }

  const avatarUrl = getAvatarUrl(profile?.avatar_path ?? null);

  return (
    <div className="mx-auto max-w-xl p-6">
      <BackHeader title="プロフィール" />

      <div className="flex items-center gap-5">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-slate-200">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-500">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-12 w-12"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={avatarBusy}
            className="rounded-lg border border-slate-300 bg-card-bg px-3 py-1.5 text-[14px] font-medium text-foreground hover:bg-slate-50 disabled:opacity-50"
          >
            {avatarBusy ? "処理中…" : "画像を変更"}
          </button>
          {profile?.avatar_path && (
            <button
              onClick={clearAvatar}
              disabled={avatarBusy}
              className="rounded-lg border border-red-300 bg-card-bg px-3 py-1.5 text-[14px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              削除
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onPickFile}
            className="hidden"
          />
        </div>
      </div>

      <section className="mt-7">
        <label className="text-[15px] font-medium text-foreground">
          表示名（ニックネーム）
        </label>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="例：たうち"
          className="mt-2 w-full rounded-lg border border-slate-300 bg-card-bg px-3 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400"
        />
      </section>

      <section className="mt-5 rounded-2xl border border-card-border bg-card-bg p-4">
        <div className="flex justify-between text-[14px]">
          <span className="text-muted">メール</span>
          <span className="text-slate-900">{profile?.email ?? "-"}</span>
        </div>
        <div className="mt-2 flex justify-between text-[14px]">
          <span className="text-muted">権限</span>
          <span className="text-slate-900">
            {profile ? roleLabel(profile.role) : "-"}
          </span>
        </div>
      </section>

      {err && <p className="mt-4 text-[14px] text-red-600">{err}</p>}
      {msg && <p className="mt-4 text-[14px] text-emerald-700">{msg}</p>}

      <button
        onClick={saveNickname}
        disabled={saving}
        className="mt-5 w-full rounded-xl bg-accent px-4 py-3 text-[16px] font-semibold text-white active:opacity-90 disabled:opacity-50"
      >
        {saving ? "保存中…" : "保存"}
      </button>
    </div>
  );
}

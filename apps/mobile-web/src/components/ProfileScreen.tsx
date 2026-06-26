import { useEffect, useRef, useState } from "react";
import {
  getMyProfile,
  updateMyProfile,
  uploadAvatar,
  removeAvatar,
  getAvatarUrl,
  type Profile,
} from "@/lib/profile";
import AvatarCropper from "./AvatarCropper";

const ROLE_LABEL: Record<string, string> = {
  general: "一般",
  admin: "管理者",
  developer: "開発者",
  trainer: "トレーナー",
};

export default function ProfileScreen({
  onBack,
  onChanged,
}: {
  onBack: () => void;
  onChanged?: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMyProfile().then((p) => {
      setProfile(p);
      setNickname(p?.nickname ?? "");
    });
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      await updateMyProfile({ nickname: nickname.trim() || null });
      setMsg("保存しました");
      onChanged?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  // 画像を選んだらクロップ画面を開く
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (file) setCropFile(file);
  }

  // クロップ確定 → アップロード
  async function onCropped(blob: Blob) {
    setCropFile(null);
    if (!profile) return;
    setAvatarBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const newPath = await uploadAvatar(blob);
      await updateMyProfile({ avatar_path: newPath });
      const old = profile.avatar_path;
      setProfile({ ...profile, avatar_path: newPath });
      if (old) await removeAvatar(old).catch(() => {});
      onChanged?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "画像のアップロードに失敗しました");
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
      onChanged?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setAvatarBusy(false);
    }
  }

  const avatarUrl = getAvatarUrl(profile?.avatar_path ?? null);

  return (
    <div className="pb-24">
      {/* ヘッダー（左寄せ・固定） */}
      <header
        className="sticky top-0 z-30 -mx-4 mb-3 border-b border-card-border bg-background px-4"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className="flex h-14 items-center gap-1">
          <button
            onClick={onBack}
            aria-label="戻る"
            className="-ml-1 px-1 text-[22px] leading-none text-foreground"
          >
            ‹
          </button>
          <span className="text-[17px] font-semibold text-foreground">
            プロフィール
          </span>
        </div>
      </header>

      {/* アバター */}
      <div className="mt-6 flex flex-col items-center">
        <div className="h-24 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="アバター"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-500 dark:text-slate-300">
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
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={avatarBusy}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-[14px] font-medium text-slate-800 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"
          >
            {avatarBusy ? "処理中…" : "画像を変更"}
          </button>
          {profile?.avatar_path && (
            <button
              onClick={clearAvatar}
              disabled={avatarBusy}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-[14px] font-medium text-red-600 disabled:opacity-50 dark:border-red-800 dark:text-red-400"
            >
              削除
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onPickFile}
          className="hidden"
        />
      </div>

      {/* 表示名 */}
      <section className="mt-7">
        <label className="text-[15px] font-medium text-slate-800 dark:text-slate-200">
          表示名（ニックネーム）
        </label>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="例：たうち"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </section>

      {/* アカウント情報（参照のみ） */}
      <section className="mt-5 rounded-2xl border border-card-border bg-card-bg p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex justify-between text-[14px]">
          <span className="text-muted">メール</span>
          <span className="text-slate-900 dark:text-slate-100">
            {profile?.email ?? "-"}
          </span>
        </div>
        <div className="mt-2 flex justify-between text-[14px]">
          <span className="text-muted">権限</span>
          <span className="text-slate-900 dark:text-slate-100">
            {profile ? (ROLE_LABEL[profile.role] ?? profile.role) : "-"}
          </span>
        </div>
      </section>

      {err && (
        <p className="mt-4 text-[14px] text-red-600 dark:text-red-400">{err}</p>
      )}
      {msg && (
        <p className="mt-4 text-[14px] text-emerald-700 dark:text-emerald-400">
          {msg}
        </p>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="mt-5 w-full rounded-xl bg-accent px-4 py-3 text-[16px] font-semibold text-white active:opacity-90 disabled:opacity-50"
      >
        {saving ? "保存中…" : "保存"}
      </button>

      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onCropped={onCropped}
        />
      )}
    </div>
  );
}

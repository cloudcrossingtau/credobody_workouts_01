import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getMyProfile,
  getAvatarUrl,
  displayName,
  profileInitial,
  roleLabel,
  type Profile,
} from "@/lib/profile";

// サイドバー下部のユーザー表示＋ログアウト。
export function SidebarUser() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const p = await getMyProfile();
      if (mounted) setProfile(p);
    };
    check();
    const sub = supabase?.auth.onAuthStateChange(() => check());
    return () => {
      mounted = false;
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  if (!profile) return null;

  const handleLogout = async () => {
    if (!confirm("ログアウトしますか？")) return;
    // Supabase SDK の signOut がまれに内部でハングするため、タイムアウト付きで呼び、
    // 失敗/タイムアウト時は localStorage の sb-* を直接消して確実にログアウトする。
    try {
      await Promise.race([
        // 操作した端末だけログアウト（他端末のセッションは維持）
        supabase?.auth.signOut({ scope: "local" }) ?? Promise.resolve(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("signOut timeout")), 3000),
        ),
      ]);
    } catch (e) {
      console.warn("[logout] signOut が失敗/タイムアウト。手動でクリアします:", e);
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("sb-")) localStorage.removeItem(key);
        }
      } catch {
        /* localStorage が使えない環境は無視 */
      }
    }
    window.location.replace("/login");
  };

  const avatarUrl = getAvatarUrl(profile.avatar_path);

  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="flex items-center gap-2 px-2 py-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-light">
          {avatarUrl && !avatarFailed ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <span className="text-[15px] font-bold text-accent">
              {profileInitial(profile)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[14px] font-medium text-foreground"
            title={profile.email ?? undefined}
          >
            {displayName(profile)}
          </p>
          <p className="text-[12px] text-slate-700">{roleLabel(profile.role)}</p>
        </div>
        <button
          onClick={handleLogout}
          title="ログアウト"
          className="shrink-0 rounded-lg p-1.5 text-slate-700 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

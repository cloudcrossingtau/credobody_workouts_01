import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

// 未ログインなら /login へ誘導する常駐チェック（サイドバー付きページで使用）。
export function AuthCheck() {
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) window.location.replace("/login");
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // 明示的なサインアウトのみ /login へ。トークン更新中の一時的な状態変化では遷移しない。
      if (event === "SIGNED_OUT") window.location.replace("/login");
    });
    return () => subscription.unsubscribe();
  }, []);
  return null;
}

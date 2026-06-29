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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) window.location.replace("/login");
    });
    return () => subscription.unsubscribe();
  }, []);
  return null;
}

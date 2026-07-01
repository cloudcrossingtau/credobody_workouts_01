import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout, TimeoutError } from "@/lib/recover";

// 未ログインなら /login へ誘導する常駐チェック（サイドバー付きページで使用）。
// スリープ復帰後などに getSession が無言で固まる事象へは、タイムアウトで検知して
// sb-* を強制クリア→/login で復帰する（nouker と同じ方式）。
export function AuthCheck() {
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    void (async () => {
      try {
        const { data } = await withTimeout(
          () => client.auth.getSession(),
          5000,
          "AuthCheck.getSession",
        );
        if (!data.session) {
          window.location.replace("/login");
        }
      } catch (e) {
        if (e instanceof TimeoutError) {
          // セッション取得自体がハング = SDK の状態が壊れている可能性が高い。
          // localStorage の sb-* を強制クリアして /login へ誘導する。
          console.error("[AuthCheck] getSession timed out, forcing logout:", e);
          try {
            for (const key of Object.keys(localStorage)) {
              if (key.startsWith("sb-")) localStorage.removeItem(key);
            }
          } catch (_) {
            // ignore
          }
          window.location.replace("/login");
        } else {
          console.error("[AuthCheck] unexpected error:", e);
        }
      }
    })();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        window.location.replace("/login");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return null;
}

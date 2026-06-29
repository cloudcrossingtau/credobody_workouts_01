import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

// セッション取得がハングしたとき（スリープ復帰後など、supabase-js がトークン更新で
// 無言で固まる事象）に、一度だけ自動リロードして復帰するためのフラグ。
const RELOAD_FLAG = "cbr-auth-recovered";

// 未ログインなら /login へ誘導する常駐チェック（サイドバー付きページで使用）。
export function AuthCheck() {
  useEffect(() => {
    if (!supabase) return;
    let settled = false;

    // ハング検知ウォッチドッグ: 一定時間で getSession が返らなければ一度だけ自動リロード。
    const watchdog = window.setTimeout(() => {
      if (settled) return;
      if (sessionStorage.getItem(RELOAD_FLAG)) return; // 既に1回リロード済み → ループ防止
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
    }, 7000);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        settled = true;
        window.clearTimeout(watchdog);
        sessionStorage.removeItem(RELOAD_FLAG); // 正常取得 → 次回のために解除
        if (!data.session) window.location.replace("/login");
      })
      .catch(() => {
        settled = true;
        window.clearTimeout(watchdog);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // 明示的なサインアウトのみ /login へ。トークン更新中の一時的な状態変化では遷移しない。
      if (event === "SIGNED_OUT") window.location.replace("/login");
    });
    return () => {
      window.clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, []);
  return null;
}

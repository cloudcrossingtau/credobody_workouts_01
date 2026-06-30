import { useEffect } from "react";

// 新しいバージョンがデプロイされていたら自動でリロードして最新化する。
// 起動時とアプリ前面復帰時にだけ /version.json を確認（連続監視しない）。
// dev(local) では無効。リロードは「同じ版に対して1回だけ」（ループ防止）。
export default function AutoUpdate() {
  useEffect(() => {
    if (import.meta.env.DEV) return; // ローカルでは無効
    const running = import.meta.env.PUBLIC_BUILD_COMMIT;
    const KEY = "cbr-update-reloaded";

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { commit?: string };
        const deployed = data.commit;
        if (!deployed || !running || deployed === running) return;
        // 同じデプロイ版へのリロードは1回だけ（配信途中などでの無限ループを防ぐ）
        if (sessionStorage.getItem(KEY) === deployed) return;
        sessionStorage.setItem(KEY, deployed);
        window.location.reload();
      } catch {
        /* オフライン等は無視 */
      }
    };

    check();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
}

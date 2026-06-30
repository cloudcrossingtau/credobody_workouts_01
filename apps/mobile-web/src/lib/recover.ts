// スリープ復帰後などに supabase-js の認証/取得が無言で固まる事象への保険。
// 取得にタイムアウトを設け、固まったら自動リロードで復帰する（ループはクールダウンで防止）。

export class TimeoutError extends Error {
  constructor(label = "timeout") {
    super(label);
    this.name = "TimeoutError";
  }
}

// promise が ms 以内に解決しなければ TimeoutError で reject する。
export function withTimeout<T>(p: Promise<T>, ms = 8000, label = "timeout"): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(label)), ms),
    ),
  ]);
}

// 直近に自動リロードしていなければ1回だけリロードする（戻り値: リロードを実行したか）。
export function autoReloadOnce(cooldownMs = 20000): boolean {
  try {
    const KEY = "cbr-reload-at";
    const last = Number(sessionStorage.getItem(KEY) || "0");
    if (Date.now() - last < cooldownMs) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

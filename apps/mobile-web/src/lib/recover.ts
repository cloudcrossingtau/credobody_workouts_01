// スリープ復帰後などに supabase-js の認証/取得が無言で固まる事象への保険。
// 非同期処理にタイムアウト＋自動リトライを付与する（nouker と同じ仕組み）。
// 何度かリトライすれば成功するケースが多く、それでも駄目なら自動リロードで復帰する。

export class TimeoutError extends Error {
  constructor(message = "operation timeout") {
    super(message);
    this.name = "TimeoutError";
  }
}

// fn() を timeoutMs 以内に解決しなければ TimeoutError で reject する。
// fn 自体は止められないため、後追いで完了した場合の結果は捨てる点に注意。
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs = 8000,
  label?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new TimeoutError(`${label ?? "operation"} timeout after ${timeoutMs}ms`),
        ),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface RetryOptions {
  // 1回あたりの待機時間 (ms)
  timeoutMs: number;
  // 最大試行回数 (=最初の試行を含む。3 なら 1 + 2回リトライ)
  maxAttempts: number;
  // ログ・エラーメッセージ用ラベル
  label?: string;
  // 各試行が失敗するたびに呼ばれる (リトライ時の通知用)
  onAttemptFail?: (attempt: number, error: unknown) => void;
}

// withTimeout + 即座リトライ。バックオフは入れない (Supabase内部で順番待ちが
// 発生していて即リトライで突破できることが多いため)。
// maxAttempts 回試して全失敗なら最後のエラーを throw。
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { timeoutMs, maxAttempts, label, onAttemptFail } = options;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await withTimeout(fn, timeoutMs, label);
    } catch (e) {
      lastError = e;
      onAttemptFail?.(attempt, e);
    }
  }
  throw lastError;
}

// 直近に自動リロードしていなければ1回だけリロードする（戻り値: リロードを実行したか）。
// クールダウン内（連続ハング時）は false を返し、呼び出し側でエラー表示にフォールバックする。
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

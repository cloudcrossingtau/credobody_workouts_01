import { createClient, processLock } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// 根本対策: supabase-js の全通信に必ずタイムアウトを付ける。
// supabase-js は内部の通信（トークン更新・DBクエリ・ストレージ）にタイムアウトを持たず、
// スリープ復帰後などにブラウザの fetch が「半開き」のまま固まると、トークン更新のロックを
// 握ったまま後続が永久に詰まる。AbortController で一定時間で必ず中断する fetch に
// 差し替えることで、固まってもロックが解放され自然復旧できる。
const FETCH_TIMEOUT_MS = 5000;
const fetchWithTimeout: typeof fetch = async (input, init = {}) => {
  const upstream = init.signal;
  // 1回分の試行（自前タイムアウトで中断したら __timedOut 印を付けて投げる）
  const run = async (): Promise<Response> => {
    const ac = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ac.abort();
    }, FETCH_TIMEOUT_MS);
    const onAbort = () => ac.abort();
    if (upstream) {
      if (upstream.aborted) ac.abort();
      else upstream.addEventListener("abort", onAbort);
    }
    try {
      return await fetch(input, { ...init, signal: ac.signal });
    } catch (e) {
      if (timedOut && !(upstream && upstream.aborted)) {
        (e as { __timedOut?: boolean }).__timedOut = true;
      }
      throw e;
    } finally {
      clearTimeout(timer);
      if (upstream) upstream.removeEventListener("abort", onAbort);
    }
  };
  try {
    return await run();
  } catch (e) {
    // 死んだ接続でのタイムアウトのみ、新しい接続で1回だけ即リトライ（操作は冪等）
    if ((e as { __timedOut?: boolean })?.__timedOut) return await run();
    throw e;
  }
};

// ロックについて:
//   - デフォルトの navigator.locks ロックは Safari 等でロック解放が遅延し、
//     認証/クエリがハングする事象がある。
//   - かといって no-op ロックにすると、タブ復帰時などにトークン更新が並行実行されて
//     競合し（リフレッシュトークンの二重使用）、セッションが壊れて勝手にログアウトされる。
//   そこで navigator.locks を使わずタブ内でトークン更新を直列化する processLock を採用。
//   ハング回避とセッション保護を両立できる（非セキュアコンテキストでも動作）。
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { lock: processLock },
        global: { fetch: fetchWithTimeout },
      })
    : null;

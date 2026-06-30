import { createClient, processLock } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// 根本対策: supabase-js の全通信に必ずタイムアウトを付ける。
// supabase-js は内部の通信（トークン更新・DBクエリ・ストレージ）にタイムアウトを持たず、
// スリープ復帰後などにブラウザの fetch が「半開き」のまま固まると、トークン更新のロックを
// 握ったまま後続が永久に詰まる。AbortController で一定時間で必ず中断する fetch に
// 差し替えることで、固まってもロックが解放され自然復旧できる。
const FETCH_TIMEOUT_MS = 10000;
const fetchWithTimeout: typeof fetch = async (input, init = {}) => {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  const upstream = init.signal;
  const onAbort = () => ac.abort();
  if (upstream) {
    if (upstream.aborted) ac.abort();
    else upstream.addEventListener("abort", onAbort);
  }
  try {
    return await fetch(input, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
    if (upstream) upstream.removeEventListener("abort", onAbort);
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

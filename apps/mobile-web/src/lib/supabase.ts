import { createClient, processLock } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// ロックについて:
//   - デフォルトの navigator.locks ロックは Safari 等でロック解放が遅延し、
//     認証/クエリがハングする事象がある。
//   - かといって no-op ロックにすると、タブ復帰時などにトークン更新が並行実行されて
//     競合し（リフレッシュトークンの二重使用）、セッションが壊れて勝手にログアウトされる。
//   そこで navigator.locks を使わずタブ内でトークン更新を直列化する processLock を採用。
//   ハング回避とセッション保護を両立できる（非セキュアコンテキストでも動作）。
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, { auth: { lock: processLock } })
    : null;

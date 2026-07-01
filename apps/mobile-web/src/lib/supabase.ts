import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Supabase JS v2 のデフォルトは navigator.locks を使ったロックだが、
// Safari 等の一部ブラウザでロック解放が遅延し、認証操作や SELECT クエリが
// ハングする事象が報告されている (特にログイン直後・タブ復帰直後)。
// 単一タブで使う想定のため、no-op ロックに置き換えて並行実行を許可する。
// （nouker と同じ構成。トークン更新の競合は auth-js が内部で直列化するため安全）
const noopLock = async <R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> => fn();

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { lock: noopLock },
      })
    : null;

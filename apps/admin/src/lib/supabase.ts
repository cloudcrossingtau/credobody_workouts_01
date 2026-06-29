import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Supabase JS v2 のデフォルトは navigator.locks を使ったロックだが、
// Safari 等でロック解放が遅延し認証/クエリがハングする事象があるため、
// 単一タブ前提で no-op ロックに置き換える（nouker と同じ方針）。
const noopLock = async <R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> => fn();

// 環境変数が未設定でもビルドは通るようにし、利用時にエラーで気付ける形にする。
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, { auth: { lock: noopLock } })
    : null;

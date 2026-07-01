// Supabase Edge Function: delete-user
//
// 目的: 指定ユーザーをアカウントごと完全削除する。
//
// 入力 (JSON body): { "user_id": "<uuid>" }
//
// 認可:
//   - Authorization: Bearer <user_jwt> ヘッダ必須
//   - 呼び出し元の profiles.role が 'developer' のみ実行可
//     (admin は不可。破壊的操作なので最高権限に限定)
//   - 自分自身は削除不可 (誤操作防止)
//
// 削除順序:
//   1. Storage  (avatars/<user_id>/... を再帰削除。Storage は auth.users の
//                CASCADE では消えないので手動で消す)
//   2. auth.users (profiles / training_items / training_records は
//                  on delete cascade で連動削除)
//
// デプロイ:
//   supabase functions deploy delete-user --project-ref <project-ref>
//
// 環境変数（Supabase が自動で渡す）:
//   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/// 指定バケットの `prefix` 配下を再帰的に列挙して全フルパスを返す。
/// Supabase storage の list() はサブフォルダを展開しないので深さ優先で辿る。
async function listAllUnderPrefix(
  client: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const all: string[] = [];
  const queue: string[] = [prefix];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const { data, error } = await client.storage
      .from(bucket)
      .list(current, { limit: 1000 });
    if (error) {
      // 存在しない prefix は無視 (削除対象が無いだけ)
      continue;
    }
    for (const item of data ?? []) {
      const fullPath = `${current}/${item.name}`;
      // id === null はフォルダ (Supabase 仕様)
      if (item.id === null) {
        queue.push(fullPath);
      } else {
        all.push(fullPath);
      }
    }
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Authorization header required" }, 401);
    }

    // 認証クライアント (JWT 検証 + 呼び出し元の user 取得)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !caller) {
      return jsonResponse({ error: "Invalid auth token" }, 401);
    }

    // service_role クライアント (admin 操作用)
    const adminClient = createClient(supabaseUrl, serviceKey);

    // 呼び出し元の role を確認 (developer のみ許可)
    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();
    if (profileError || !callerProfile) {
      return jsonResponse({ error: "Caller profile not found" }, 403);
    }
    if (callerProfile.role !== "developer") {
      return jsonResponse(
        { error: "Forbidden: developer role required" },
        403,
      );
    }

    // 入力検証 (JSON body { user_id })
    let body: { user_id?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Body must be JSON" }, 400);
    }
    const userId = (body.user_id ?? "").trim();
    if (!userId) {
      return jsonResponse({ error: "user_id is required" }, 400);
    }
    // ごく緩い uuid 形式チェック
    if (!/^[0-9a-fA-F-]{36}$/.test(userId)) {
      return jsonResponse({ error: "user_id format is invalid" }, 400);
    }

    // 自分自身は削除不可
    if (userId === caller.id) {
      return jsonResponse({ error: "Cannot delete yourself" }, 400);
    }

    // 削除対象の存在確認 (auth.users から)
    const { data: targetData, error: targetError } =
      await adminClient.auth.admin.getUserById(userId);
    if (targetError || !targetData?.user) {
      return jsonResponse({ error: "Target user not found" }, 404);
    }

    // --- 削除実行 ---

    // 1. Storage 削除 (avatars バケットの user_id 配下)
    //    Storage オブジェクトは auth.users の CASCADE では消えないので手動削除。
    let storageDeleted = 0;
    try {
      const avatarFiles = await listAllUnderPrefix(adminClient, "avatars", userId);
      if (avatarFiles.length > 0) {
        const { error: rmError } = await adminClient.storage
          .from("avatars")
          .remove(avatarFiles);
        if (rmError) throw new Error(`avatars remove: ${rmError.message}`);
        storageDeleted += avatarFiles.length;
      }
    } catch (e) {
      return jsonResponse(
        { error: `storage delete failed: ${String(e)}` },
        500,
      );
    }

    // 2. auth.users (profiles / training_items / training_records は CASCADE で連動削除)
    const { error: authDeleteError } =
      await adminClient.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      return jsonResponse(
        { error: `auth.users delete failed: ${authDeleteError.message}` },
        500,
      );
    }

    return jsonResponse({
      ok: true,
      deleted: {
        user_id: userId,
        email: targetData.user.email,
        storage_files: storageDeleted,
      },
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});

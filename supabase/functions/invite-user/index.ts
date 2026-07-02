// Supabase Edge Function: invite-user
//
// 目的: 管理者/開発者が指定メールアドレスへ Supabase 招待メールを送る（招待制）。
//
// 入力 (JSON body): { "email": "user@example.com", "redirectTo"?: "https://.../" }
//
// 認可:
//   - Authorization: Bearer <user_jwt> ヘッダ必須
//   - 呼び出し元 profiles.role が 'admin' or 'developer' のみ実行可
//
// デプロイ:
//   supabase functions deploy invite-user --project-ref <project-ref>
//
// 環境変数（Supabase が自動で渡す）:
//   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // 呼び出し元の JWT 検証
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Invalid auth token" }, 401);
    }

    // service_role クライアント（admin 操作用）
    const adminClient = createClient(supabaseUrl, serviceKey);

    // 呼び出し元の role 確認（admin or developer のみ）
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return jsonResponse({ error: "Caller profile not found" }, 403);
    }
    if (profile.role !== "admin" && profile.role !== "developer") {
      return jsonResponse(
        { error: "Forbidden: admin or developer role required" },
        403,
      );
    }

    // 入力検証
    let body: { email?: string; redirectTo?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Body must be JSON" }, 400);
    }
    const email = (body.email ?? "").trim();
    if (!email) {
      return jsonResponse({ error: "email is required" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "email format is invalid" }, 400);
    }

    const inviteOptions = body.redirectTo
      ? { redirectTo: body.redirectTo }
      : undefined;
    const { data, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, inviteOptions);
    if (inviteError) {
      return jsonResponse(
        { error: inviteError.message || "invite failed" },
        400,
      );
    }

    // 監査ログ記録（成功後）。記録失敗で招待結果は変えない。
    const { error: auditError } = await adminClient.from("audit_logs").insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      action: "invite_user",
      target_type: "user",
      target_id: data.user?.id ?? null,
      target_label: email,
      detail: null,
    });
    if (auditError) {
      console.error("[invite-user] audit log insert failed:", auditError.message);
    }

    return jsonResponse({ ok: true, userId: data.user?.id ?? null });
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : "unexpected error" },
      500,
    );
  }
});

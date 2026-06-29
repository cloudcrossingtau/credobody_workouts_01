import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getMyProfile } from "@/lib/profile";

export function InvitePage() {
  const [role, setRole] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getMyProfile().then((p) => {
      setRole(p?.role ?? null);
      setLoaded(true);
    });
  }, []);

  async function invite() {
    if (!supabase) return;
    const em = email.trim();
    if (!em) return;
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.functions.invoke("invite-user", {
        body: { email: em, redirectTo: window.location.origin },
      });
      if (error) {
        let detail = error.message;
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const b = await ctx.json();
            if (b?.error) detail = b.error;
          } catch {
            /* JSONでなければ message のまま */
          }
        }
        throw new Error(detail);
      }
      setMsg(`${em} に招待メールを送信しました。`);
      setEmail("");
    } catch (e) {
      setMsg("招待に失敗しました：" + (e instanceof Error ? e.message : "不明なエラー"));
    } finally {
      setBusy(false);
    }
  }

  const canInvite = role === "admin" || role === "developer";

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="mb-5 flex items-center gap-2">
        <a
          href="/settings"
          className="rounded-lg px-2 py-1 text-[15px] text-accent hover:bg-slate-100"
        >
          ‹ 設定
        </a>
        <h2 className="text-[20px] font-semibold text-foreground">
          ユーザー招待
        </h2>
      </div>

      {!loaded ? (
        <p className="text-[15px] text-muted">読み込み中…</p>
      ) : !canInvite ? (
        <p className="text-[15px] text-foreground">
          この操作には管理者または開発者の権限が必要です。
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="招待するメールアドレス"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-card-bg px-3 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400"
            />
            <button
              onClick={invite}
              disabled={busy}
              className="shrink-0 rounded-xl bg-accent px-5 py-2.5 text-[15px] font-semibold text-white active:opacity-90 disabled:opacity-50"
            >
              {busy ? "送信中…" : "招待"}
            </button>
          </div>
          {msg && <p className="mt-3 text-[14px] text-slate-700">{msg}</p>}
        </>
      )}
    </div>
  );
}

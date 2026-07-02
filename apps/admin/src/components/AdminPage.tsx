import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getMyProfile } from "@/lib/profile";
import { withTimeout, TimeoutError } from "@/lib/recover";

// 管理タブ。管理者/開発者向けの管理系機能（まずはユーザー招待）。今後ここに追加していく。
export function AdminPage() {
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
      // invoke 自体はタイムアウトを持たないため withTimeout で必ず数秒で settle させる。
      const { error } = await withTimeout(
        () =>
          supabase.functions.invoke("invite-user", {
            body: { email: em, redirectTo: window.location.origin },
          }),
        15000,
        "invite-user",
      );
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
      if (e instanceof TimeoutError) {
        setMsg(
          "時間内に応答がありませんでした。通信状況を確認して、もう一度お試しください。",
        );
      } else {
        setMsg(
          "招待に失敗しました：" + (e instanceof Error ? e.message : "不明なエラー"),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const canManage = role === "admin" || role === "developer";

  return (
    <div className="mx-auto max-w-2xl">
      {!loaded ? (
        <p className="text-[15px] text-muted">読み込み中…</p>
      ) : !canManage ? (
        <p className="text-[15px] text-foreground">
          この画面には管理者または開発者の権限が必要です。
        </p>
      ) : (
        <section className="rounded-2xl border border-card-border bg-card-bg p-5">
          <h3 className="text-[16px] font-semibold text-slate-900">
            ユーザー招待
          </h3>
          <p className="mt-1 text-[13px] text-muted">
            メールアドレスに招待リンクを送信します。
          </p>
          <div className="mt-3 flex gap-2">
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
        </section>
      )}
    </div>
  );
}

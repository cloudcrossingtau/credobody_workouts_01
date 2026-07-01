import { useState } from "react";
import { supabase } from "@/lib/supabase";

// パスワード再設定の申請画面。メールアドレスを入力すると、再設定リンク付きのメールが届く。
// リンクを開くと /auth/reset-password で新しいパスワードを設定できる。
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const em = email.trim();
    if (!em) return;
    setBusy(true);
    setErr(null);
    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo,
      });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      setErr(
        "メールの送信に失敗しました：" +
          (e instanceof Error ? e.message : "不明なエラー"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-card-border bg-card-bg p-7">
        <h1 className="text-center text-xl font-semibold text-slate-900">
          パスワードを再設定
        </h1>

        {sent ? (
          <div className="mt-5 space-y-3 text-center">
            <p className="text-[15px] font-medium text-slate-900">
              「{email.trim()}」にメールを送信しました。
            </p>
            <p className="text-[14px] text-muted">
              メール内のリンクを開いて、新しいパスワードを設定してください。
              届かない場合は迷惑メールフォルダもご確認ください。
            </p>
            <a href="/" className="inline-block text-[15px] font-medium text-accent">
              ログイン画面に戻る
            </a>
          </div>
        ) : (
          <>
            <p className="mt-2 text-center text-[14px] text-muted">
              登録したメールアドレスを入力してください。再設定用のリンクをお送りします。
            </p>
            <form onSubmit={submit} className="mt-5 space-y-3">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレス"
                required
                className="w-full rounded-lg border border-slate-300 bg-card-bg px-3 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400"
              />
              {err && <p className="text-[14px] text-red-600">{err}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-accent px-4 py-3 text-[16px] font-semibold text-white active:opacity-90 disabled:opacity-50"
              >
                {busy ? "送信中…" : "再設定メールを送信"}
              </button>
            </form>
            <div className="mt-5 text-center">
              <a href="/" className="text-[15px] text-accent">
                ログイン画面に戻る
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

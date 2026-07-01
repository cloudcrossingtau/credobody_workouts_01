import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// 新パスワード入力画面。メールのリンクから来ると supabase-js が URL のリカバリトークンを
// 自動検出してセッションを確立するので、その状態で updateUser({ password }) で更新する。
export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase) {
      setHasSession(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < 6) {
      setErr("パスワードは6文字以上で入力してください。");
      return;
    }
    if (password !== confirm) {
      setErr("確認用パスワードが一致しません。");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      await supabase.auth.signOut({ scope: "local" });
    } catch (e) {
      setErr(
        "パスワードの更新に失敗しました：" +
          (e instanceof Error ? e.message : "不明なエラー"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-card-border bg-card-bg p-7 shadow-sm">
        <h1 className="text-center text-xl font-semibold text-slate-900">
          新しいパスワードを設定
        </h1>

        {hasSession === false && !done ? (
          <div className="mt-5 space-y-3 text-center">
            <p className="text-[15px] font-medium text-red-600">
              リンクが無効か、有効期限が切れています。
            </p>
            <a
              href="/auth/forgot-password"
              className="inline-block text-[15px] font-medium text-accent"
            >
              再度メールを送信する
            </a>
          </div>
        ) : done ? (
          <div className="mt-5 space-y-3 text-center">
            <p className="text-[15px] font-medium text-slate-900">
              パスワードを変更しました。
            </p>
            <a
              href="/login"
              className="inline-block text-[15px] font-medium text-accent"
            >
              ログイン画面へ
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="新しいパスワード（6文字以上）"
              required
              minLength={6}
              className="w-full rounded-lg border border-slate-300 bg-card-bg px-3 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="新しいパスワード（確認）"
              required
              minLength={6}
              className="w-full rounded-lg border border-slate-300 bg-card-bg px-3 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400"
            />
            {err && <p className="text-[14px] text-red-600">{err}</p>}
            <button
              type="submit"
              disabled={busy || hasSession !== true}
              className="w-full rounded-xl bg-accent px-4 py-3 text-[16px] font-semibold text-white active:opacity-90 disabled:opacity-50"
            >
              {busy ? "更新中…" : "パスワードを変更"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

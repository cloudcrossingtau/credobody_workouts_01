import { useState } from "react";
import { supabase } from "@/lib/supabase";

// 招待メール/パスワード再設定リンクからの初回パスワード設定画面
export default function SetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!supabase) return;
    setErr(null);
    if (password.length < 6) {
      setErr("パスワードは6文字以上にしてください。");
      return;
    }
    if (password !== password2) {
      setErr("確認用パスワードが一致しません。");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラーが発生しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-card-border bg-card-bg p-6 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-center text-xl font-semibold text-slate-900 dark:text-slate-100">
          パスワードを設定
        </h1>
        <p className="mt-2 text-center text-[14px] text-muted">
          ログイン用のパスワードを設定してください。
        </p>
        <div className="mt-4 space-y-3">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="新しいパスワード（6文字以上）"
            className="w-full rounded-lg border border-slate-300 bg-card-bg px-3 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <input
            type="password"
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="パスワード（確認）"
            className="w-full rounded-lg border border-slate-300 bg-card-bg px-3 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        {err && (
          <p className="mt-3 text-[14px] text-red-600 dark:text-red-400">{err}</p>
        )}
        <button
          onClick={submit}
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-accent px-4 py-3 text-[16px] font-semibold text-white active:opacity-90 disabled:opacity-50"
        >
          {busy ? "設定中…" : "設定して開始"}
        </button>
      </div>
    </div>
  );
}

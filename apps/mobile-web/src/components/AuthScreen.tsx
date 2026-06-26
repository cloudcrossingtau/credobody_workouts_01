import { useState } from "react";
import { supabase } from "@/lib/supabase";

// 招待制：PUBLIC_DISABLE_SIGNUP=true で新規登録UIを非表示にする
const DISABLE_SIGNUP = import.meta.env.PUBLIC_DISABLE_SIGNUP === "true";

// ログイン / 新規登録画面（メール＋パスワード）
export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!supabase) return;
    setErr(null);
    setMsg(null);
    const em = email.trim();
    if (!em || !password) {
      setErr("メールアドレスとパスワードを入力してください。");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setErr("パスワードは6文字以上にしてください。");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: em,
          password,
        });
        if (error) throw error;
        // 成功すると onAuthStateChange を親が拾って画面が切り替わる
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: em,
          password,
        });
        if (error) throw error;
        if (!data.session) {
          // メール確認が有効な場合はここに来る
          setMsg(
            "確認メールを送信しました。メール内のリンクを開いて認証後、ログインしてください。",
          );
          setMode("login");
        }
      }
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
          トレーニング記録
        </h1>

        {/* ログイン / 新規登録 トグル（招待制では新規登録を非表示） */}
        {!DISABLE_SIGNUP && (
          <div className="mt-5 flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
            <button
              onClick={() => {
                setMode("login");
                setErr(null);
                setMsg(null);
              }}
              className={`flex-1 py-2 text-[15px] font-medium ${
                mode === "login"
                  ? "bg-accent text-white"
                  : "bg-card-bg text-slate-800 dark:bg-slate-800 dark:text-slate-100"
              }`}
            >
              ログイン
            </button>
            <button
              onClick={() => {
                setMode("signup");
                setErr(null);
                setMsg(null);
              }}
              className={`flex-1 py-2 text-[15px] font-medium ${
                mode === "signup"
                  ? "bg-accent text-white"
                  : "bg-card-bg text-slate-800 dark:bg-slate-800 dark:text-slate-100"
              }`}
            >
              新規登録
            </button>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="パスワード（6文字以上）"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {err && (
          <p className="mt-3 text-[14px] text-red-600 dark:text-red-400">{err}</p>
        )}
        {msg && (
          <p className="mt-3 text-[14px] text-emerald-700 dark:text-emerald-400">
            {msg}
          </p>
        )}

        <button
          onClick={submit}
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-accent px-4 py-3 text-[16px] font-semibold text-white active:opacity-90 disabled:opacity-50"
        >
          {busy
            ? "処理中…"
            : mode === "login"
              ? "ログイン"
              : "登録する"}
        </button>
      </div>
    </div>
  );
}

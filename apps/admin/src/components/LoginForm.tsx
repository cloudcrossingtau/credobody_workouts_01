import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// 招待制：PUBLIC_DISABLE_SIGNUP=true で新規登録UIを非表示
const DISABLE_SIGNUP = import.meta.env.PUBLIC_DISABLE_SIGNUP === "true";
const LS_EMAIL = "credobody.email";

// 管理画面のログイン / 新規登録（メール＋パスワード）。成功で / へ遷移。
export function LoginForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // すでにログイン済みなら / へ
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace("/");
    });
    const saved = localStorage.getItem(LS_EMAIL);
    if (saved) setEmail(saved);
  }, []);

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
      localStorage.setItem(LS_EMAIL, em);
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: em,
          password,
        });
        if (error) throw error;
        window.location.replace("/");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: em,
          password,
        });
        if (error) throw error;
        if (data.session) {
          window.location.replace("/");
        } else {
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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-card-border bg-card-bg p-7 shadow-sm">
        <h1 className="flex items-center justify-center gap-2 text-xl font-semibold text-slate-900">
          <img src="/icon.png" alt="" className="h-7 w-7" />
          CredoBodyRise
          {import.meta.env.DEV && (
            <span className="rounded bg-yellow-400 px-1.5 py-0.5 text-[11px] font-bold text-yellow-900">
              LOCAL
            </span>
          )}
        </h1>

        {!DISABLE_SIGNUP && (
          <div className="mt-5 flex overflow-hidden rounded-lg border border-slate-300">
            <button
              onClick={() => {
                setMode("login");
                setErr(null);
                setMsg(null);
              }}
              className={`flex-1 py-2 text-[15px] font-medium ${
                mode === "login"
                  ? "bg-accent text-white"
                  : "bg-card-bg text-slate-800"
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
                  : "bg-card-bg text-slate-800"
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
            className="w-full rounded-lg border border-slate-300 bg-card-bg px-3 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400"
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
            className="w-full rounded-lg border border-slate-300 bg-card-bg px-3 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {err && <p className="mt-3 text-[14px] text-red-600">{err}</p>}
        {msg && <p className="mt-3 text-[14px] text-emerald-700">{msg}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-accent px-4 py-3 text-[16px] font-semibold text-white active:opacity-90 disabled:opacity-50"
        >
          {busy ? "処理中…" : mode === "login" ? "ログイン" : "登録する"}
        </button>
      </div>
    </div>
  );
}

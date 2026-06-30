import { useEffect, useState } from "react";
import {
  listAllUsers,
  updateUserRole,
  currentUserId,
  ROLES,
  type AdminUser,
  type Role,
} from "@/lib/users";
import { getAvatarUrl, roleLabel } from "@/lib/profile";
import { Avatar } from "@/components/Avatar";
import { OnlineUsers } from "@/components/OnlineUsers";
import { RefreshButton } from "@/components/RefreshButton";

function userName(u: AdminUser): string {
  return u.nickname?.trim() || u.email?.split("@")[0] || "（名称未設定）";
}

// 開発者専用: 登録ユーザーの一覧とロール変更。
// 削除（auth ユーザー削除）は service_role が必要なため今回は未対応。
export function DeveloperPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  // 行ごとの編集中ロール
  const [draft, setDraft] = useState<Record<string, Role>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});

  async function load() {
    setError(null);
    setUsers(null);
    try {
      const [list, me] = await Promise.all([listAllUsers(), currentUserId()]);
      setMeId(me);
      setUsers(list);
      setDraft(Object.fromEntries(list.map((u) => [u.id, u.role])));
    } catch (e) {
      console.warn("[developer] load failed:", e);
      setError("読み込みに失敗しました。権限（開発者）と通信状況を確認してください。");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save(u: AdminUser) {
    const role = draft[u.id];
    if (!role || role === u.role) return;
    // 自分自身を developer から外すとロックアウトするため禁止
    if (u.id === meId && role !== "developer") {
      setRowMsg((m) => ({
        ...m,
        [u.id]: "自分自身の開発者権限は外せません。",
      }));
      return;
    }
    if (
      !confirm(
        `${userName(u)} さんのロールを「${roleLabel(role)}」に変更します。よろしいですか？`,
      )
    )
      return;
    setSavingId(u.id);
    setRowMsg((m) => ({ ...m, [u.id]: "" }));
    try {
      await updateUserRole(u.id, role);
      setUsers((prev) =>
        prev ? prev.map((x) => (x.id === u.id ? { ...x, role } : x)) : prev,
      );
      setRowMsg((m) => ({ ...m, [u.id]: "保存しました" }));
    } catch (e) {
      console.warn("[developer] role update failed:", e);
      setRowMsg((m) => ({ ...m, [u.id]: "保存に失敗しました" }));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[20px] font-semibold text-foreground">開発</h2>
        <RefreshButton onClick={load} />
      </div>
      <p className="mb-5 text-[13px] text-muted">
        登録ユーザーの一覧とロール変更（開発者のみ）。
      </p>

      <OnlineUsers />

      {error && <p className="text-[15px] text-red-600">{error}</p>}
      {!users && !error && (
        <p className="py-16 text-center text-[15px] text-muted">読み込み中…</p>
      )}

      {users && (
        <>
          <p className="mb-3 text-[13px] text-muted">
            登録ユーザー {users.length} 名
          </p>
          <div className="space-y-2">
            {users.map((u) => {
              const changed = draft[u.id] !== u.role;
              const isMe = u.id === meId;
              return (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-card-border bg-card-bg p-4"
                >
                  <Avatar
                    url={getAvatarUrl(u.avatarPath)}
                    fallback={userName(u).charAt(0).toUpperCase()}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-foreground">
                      {userName(u)}
                      {isMe && (
                        <span className="ml-2 rounded bg-accent-light px-1.5 py-0.5 text-[11px] font-bold text-accent">
                          あなた
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[13px] text-muted">
                      {u.email ?? "-"}
                    </p>
                  </div>
                  <select
                    value={draft[u.id] ?? u.role}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [u.id]: e.target.value as Role }))
                    }
                    className="rounded-lg border border-slate-300 bg-card-bg px-2.5 py-2 text-[15px] text-slate-900"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => save(u)}
                    disabled={!changed || savingId === u.id}
                    className="rounded-lg bg-accent px-3 py-2 text-[14px] font-semibold text-white disabled:opacity-40"
                  >
                    {savingId === u.id ? "保存中…" : "保存"}
                  </button>
                  {rowMsg[u.id] && (
                    <span
                      className={`w-full text-right text-[13px] ${
                        rowMsg[u.id] === "保存しました"
                          ? "text-emerald-700"
                          : "text-red-600"
                      }`}
                    >
                      {rowMsg[u.id]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-[12px] text-muted">
            ※ ユーザーの削除（アカウント削除）は管理者キーが必要なため、現在は未対応です。
          </p>
        </>
      )}
    </div>
  );
}

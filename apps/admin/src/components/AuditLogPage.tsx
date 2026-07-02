import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withRetry } from "@/lib/recover";

// 監査ログ 1 件。invite_user / delete_user / change_role を統一テーブルに記録。
type AuditLog = {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  detail: Record<string, unknown> | null;
};

const ACTION_LABELS: Record<string, string> = {
  invite_user: "招待",
  delete_user: "ユーザー削除",
  change_role: "権限変更",
};

const ACTION_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "すべて" },
  { value: "invite_user", label: "招待" },
  { value: "delete_user", label: "ユーザー削除" },
  { value: "change_role", label: "権限変更" },
];

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtDetail(log: AuditLog): string {
  const detail = log.detail;
  if (!detail) return "";
  if (log.action === "change_role") {
    const from = (detail as { from?: string }).from ?? "?";
    const to = (detail as { to?: string }).to ?? "?";
    return `${from} → ${to}`;
  }
  if (log.action === "delete_user") {
    const d = detail as { storageDeleted?: number };
    return `ファイル ${d.storageDeleted ?? 0} 件を連動削除`;
  }
  return JSON.stringify(detail);
}

function actionBadgeClass(action: string): string {
  switch (action) {
    case "delete_user":
      return "bg-red-50 text-red-700 border border-red-300";
    case "change_role":
      return "bg-amber-50 text-amber-800 border border-amber-300";
    default:
      return "bg-green-50 text-green-700 border border-green-300";
  }
}

// 監査ログ閲覧（開発者専用ページ）。招待・ユーザー削除・権限変更を新しい順に表示。
export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      if (!supabase) {
        setLoading(false);
        return;
      }
      try {
        const data = await withRetry(
          () => {
            let query = supabase!.from("audit_logs").select("*");
            if (actionFilter) query = query.eq("action", actionFilter);
            return query
              .order("created_at", { ascending: false })
              .limit(300)
              .then(({ data, error }) => {
                if (error) throw error;
                return (data ?? []) as AuditLog[];
              });
          },
          { timeoutMs: 5000, maxAttempts: 3, label: "audit_logs" },
        );
        if (cancelled) return;
        setLogs(data);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "読み込みに失敗しました");
        setLogs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actionFilter]);

  return (
    <div className="max-w-5xl">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-[20px] font-semibold text-foreground">監査ログ</h2>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-[15px] text-foreground"
        >
          {ACTION_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-4 text-[14px] text-muted">
        招待・ユーザー削除・権限変更を記録します（直近 300 件）。記録開始より前の操作は残っていません。
      </p>

      {error && (
        <p className="mb-3 text-[15px] text-red-700">読み込みエラー: {error}</p>
      )}

      {loading ? (
        <p className="text-[15px] text-muted">読み込み中…</p>
      ) : logs.length === 0 ? (
        <p className="text-[15px] text-muted">ログはまだありません。</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-card-border">
          <table className="w-full text-[15px] text-foreground">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="whitespace-nowrap px-3 py-2 font-semibold">日時</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">操作</th>
                <th className="px-3 py-2 font-semibold">実行者</th>
                <th className="px-3 py-2 font-semibold">対象</th>
                <th className="px-3 py-2 font-semibold">詳細</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-card-border align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-[14px] text-muted">
                    {fmtDateTime(log.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[13px] font-medium ${actionBadgeClass(log.action)}`}
                    >
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="break-all px-3 py-2">
                    {log.actor_email ?? log.actor_id ?? "—"}
                  </td>
                  <td className="break-all px-3 py-2">
                    {log.target_label ?? log.target_id ?? "—"}
                  </td>
                  <td className="break-all px-3 py-2 text-muted">
                    {fmtDetail(log)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

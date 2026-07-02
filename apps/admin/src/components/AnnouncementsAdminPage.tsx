import { useCallback, useEffect, useState } from "react";
import {
  listAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type Announcement,
} from "@/lib/announcements";

// <input type="datetime-local"> 用（YYYY-MM-DDTHH:mm）に整形。
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface DraftState {
  title: string;
  body: string;
  isPublished: boolean;
  endsAtLocal: string;
}
const emptyDraft: DraftState = {
  title: "",
  body: "",
  isPublished: false,
  endsAtLocal: "",
};

export function AnnouncementsAdminPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // 編集中の id（null=新規作成、undefined=フォーム閉じている）
  const [editingId, setEditingId] = useState<string | null | undefined>(
    undefined,
  );
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await listAllAnnouncements());
    } catch (e) {
      console.error(e);
      setError("読み込みに失敗しました。権限（管理者）と通信状況を確認してください。");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
  };
  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setDraft({
      title: a.title,
      body: a.body,
      isPublished: a.is_published,
      endsAtLocal: isoToLocalInput(a.ends_at),
    });
  };
  const cancelEdit = () => {
    setEditingId(undefined);
    setDraft(emptyDraft);
  };

  const handleSave = async () => {
    if (!draft.title.trim() || !draft.body.trim()) {
      alert("タイトルと本文は必須です。");
      return;
    }
    setSaving(true);
    try {
      const params = {
        title: draft.title.trim(),
        body: draft.body,
        isPublished: draft.isPublished,
        endsAt: localInputToIso(draft.endsAtLocal),
      };
      if (editingId === null) {
        await createAnnouncement(params);
      } else if (editingId) {
        await updateAnnouncement(editingId, params);
      }
      await load();
      setEditingId(undefined);
      setDraft(emptyDraft);
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました。");
    }
    setSaving(false);
  };

  const handleDelete = async (a: Announcement) => {
    if (!window.confirm(`「${a.title}」を削除しますか？`)) return;
    try {
      await deleteAnnouncement(a.id);
      await load();
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました。");
    }
  };

  const isExpired = (a: Announcement): boolean =>
    !!a.ends_at && new Date(a.ends_at).getTime() <= Date.now();

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-semibold text-foreground">お知らせ管理</h2>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-card-bg px-3 py-1.5 text-[15px] text-slate-800 disabled:opacity-50"
          >
            {loading ? "読み込み中…" : "更新"}
          </button>
          <button
            onClick={startCreate}
            disabled={editingId !== undefined}
            className="rounded-lg bg-accent px-3 py-1.5 text-[15px] font-semibold text-white active:opacity-90 disabled:opacity-50"
          >
            ＋ 新規投稿
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[15px] text-red-700">
          {error}
        </div>
      )}

      {editingId !== undefined && (
        <div className="space-y-3 rounded-xl border border-card-border bg-card-bg p-4">
          <h3 className="text-[15px] font-semibold text-foreground">
            {editingId === null ? "新規投稿" : "編集"}
          </h3>
          <div>
            <label className="mb-1 block text-[13px] text-muted">
              タイトル <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="例: 2026年7月10日 メンテナンスのお知らせ"
              className="w-full rounded-lg border border-slate-300 bg-card-bg px-3 py-2 text-[15px] text-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-[13px] text-muted">
              本文 <span className="text-red-600">*</span>
            </label>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={6}
              placeholder="改行はそのまま表示されます"
              className="w-full rounded-lg border border-slate-300 bg-card-bg px-3 py-2 text-[15px] text-slate-900"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <label className="mb-1 block text-[13px] text-muted">
                公開終了（任意。過ぎたら自動で非表示）
              </label>
              <input
                type="datetime-local"
                value={draft.endsAtLocal}
                onChange={(e) =>
                  setDraft({ ...draft, endsAtLocal: e.target.value })
                }
                className="rounded-lg border border-slate-300 bg-card-bg px-3 py-2 text-[15px] text-slate-900"
              />
            </div>
            <label className="flex items-center gap-2 text-[15px] text-foreground sm:self-end sm:pb-2">
              <input
                type="checkbox"
                checked={draft.isPublished}
                onChange={(e) =>
                  setDraft({ ...draft, isPublished: e.target.checked })
                }
                className="h-4 w-4"
              />
              公開する
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="rounded-lg border border-slate-300 bg-card-bg px-3 py-1.5 text-[15px] text-slate-800 disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-accent px-3 py-1.5 text-[15px] font-semibold text-white active:opacity-90 disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-card-border bg-card-bg">
        <table className="w-full text-[15px]">
          <thead className="bg-gray-50 text-slate-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">タイトル</th>
              <th className="w-24 px-4 py-3 text-left font-semibold">状態</th>
              <th className="w-40 px-4 py-3 text-left font-semibold">公開終了</th>
              <th className="w-40 px-4 py-3 text-left font-semibold">作成日時</th>
              <th className="w-28 px-4 py-3 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-700">
                  まだお知らせがありません。
                </td>
              </tr>
            )}
            {items.map((a) => {
              const expired = isExpired(a);
              return (
                <tr
                  key={a.id}
                  className="border-t border-card-border align-top text-slate-900"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{a.title}</p>
                    <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[13px] text-slate-700">
                      {a.body}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {expired ? (
                      <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-[13px] text-gray-700">
                        期限切れ
                      </span>
                    ) : a.is_published ? (
                      <span className="inline-block rounded bg-green-100 px-2 py-0.5 text-[13px] text-green-800">
                        公開中
                      </span>
                    ) : (
                      <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-[13px] text-gray-700">
                        下書き
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-800">
                    {a.ends_at ? formatDateTime(a.ends_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-800">
                    {formatDateTime(a.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(a)}
                        disabled={editingId !== undefined}
                        className="rounded border border-slate-300 px-3 py-1 text-[15px] text-slate-800 disabled:opacity-40"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(a)}
                        className="rounded border border-red-300 px-3 py-1 text-[15px] text-red-700 hover:bg-red-50"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

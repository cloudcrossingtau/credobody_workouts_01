import { useEffect, useState } from "react";
import {
  fetchMyReadAnnouncementIds,
  listActiveAnnouncements,
  markAnnouncementsRead,
  type Announcement,
} from "@/lib/announcements";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AnnouncementsListPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  // 開く前の既読集合スナップショット（NEW バッジは「開く前に未読だった」基準）。
  const [readBefore, setReadBefore] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listActiveAnnouncements(), fetchMyReadAnnouncementIds()])
      .then(([all, read]) => {
        if (cancelled) return;
        setItems(all);
        setReadBefore(read);
        // 表示中の全件をまとめて既読化（重複は upsert で無視）
        const unreadIds = all.filter((a) => !read.has(a.id)).map((a) => a.id);
        if (unreadIds.length > 0) {
          void markAnnouncementsRead(unreadIds).catch((e) =>
            console.warn("[AnnouncementsListPage] markRead failed", e),
          );
        }
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setError("読み込みに失敗しました。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="pt-8 text-center text-[15px] text-muted">読み込み中…</div>
    );
  }
  if (error) {
    return (
      <div className="pt-8 text-center text-[15px] text-red-700">{error}</div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="pt-12 text-center text-[15px] text-muted">
        現在お知らせはありません。
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-8 pt-4">
      {items.map((a) => {
        const wasUnread = !readBefore.has(a.id);
        return (
          <article
            key={a.id}
            className="rounded-xl border border-card-border bg-card-bg p-4"
          >
            <div className="mb-1 flex items-center gap-2">
              <p className="text-[13px] text-muted">
                {formatDateTime(a.created_at)}
              </p>
              {wasUnread && (
                <span className="inline-block rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                  NEW
                </span>
              )}
            </div>
            <h2 className="mb-2 text-[17px] font-bold text-foreground">
              {a.title}
            </h2>
            <p className="whitespace-pre-wrap wrap-break-word text-[15px] text-foreground">
              {a.body}
            </p>
          </article>
        );
      })}
    </div>
  );
}

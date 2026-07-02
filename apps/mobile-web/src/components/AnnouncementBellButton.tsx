import { useCallback, useEffect, useState } from "react";
import {
  fetchMyReadAnnouncementIds,
  listActiveAnnouncements,
} from "@/lib/announcements";

// ホームヘッダに置く「お知らせ」ベル。未読件数を赤バッジで表示し、/announcements へ遷移。
// ヘッダ部品なので失敗は無音（本体機能を邪魔しない）。タブ再フォーカスで再取得。
export function AnnouncementBellButton() {
  const [unreadCount, setUnreadCount] = useState(0);

  const reload = useCallback(async () => {
    try {
      const [active, read] = await Promise.all([
        listActiveAnnouncements(),
        fetchMyReadAnnouncementIds(),
      ]);
      setUnreadCount(active.filter((a) => !read.has(a.id)).length);
    } catch (e) {
      console.warn("[AnnouncementBellButton] reload failed", e);
    }
  }, []);

  useEffect(() => {
    reload();
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  return (
    <a
      href="/announcements"
      aria-label={`お知らせ${unreadCount > 0 ? `（未読${unreadCount}件）` : ""}`}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-card-bg text-slate-600 active:opacity-90 dark:border-slate-600 dark:text-slate-300"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unreadCount > 0 && (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-background bg-red-600 px-1 text-[11px] font-bold text-white"
          aria-hidden
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </a>
  );
}

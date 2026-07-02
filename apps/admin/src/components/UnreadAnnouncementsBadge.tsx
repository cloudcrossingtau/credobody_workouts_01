import { useCallback, useEffect, useState } from "react";
import {
  fetchMyReadAnnouncementIds,
  listActiveAnnouncements,
} from "@/lib/announcements";

// サイドバーの「お知らせ」項目に付ける未読バッジ。0 件のときは描画しない。
// タブ復帰（focus）で再取得。装飾なので失敗は無音。
export function UnreadAnnouncementsBadge() {
  const [count, setCount] = useState(0);

  const reload = useCallback(async () => {
    try {
      const [active, read] = await Promise.all([
        listActiveAnnouncements(),
        fetchMyReadAnnouncementIds(),
      ]);
      setCount(active.filter((a) => !read.has(a.id)).length);
    } catch (e) {
      console.warn("[UnreadAnnouncementsBadge] reload failed", e);
    }
  }, []);

  useEffect(() => {
    reload();
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  if (count === 0) return null;

  return (
    <span
      className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white"
      aria-label={`未読 ${count} 件`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

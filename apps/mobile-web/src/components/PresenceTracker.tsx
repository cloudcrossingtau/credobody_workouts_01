import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getMyProfile, touchMyLastActiveAt } from "@/lib/profile";

const PRESENCE_CHANNEL = "credobody-presence";
const LAST_ACTIVE_HEARTBEAT_MS = 5 * 60 * 1000;

// ログイン中、自分の在席を presence チャンネルに track する。
// 管理画面(admin)の「開発」タブで、誰がアプリを利用中かを確認するために使う。
export default function PresenceTracker() {
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const p = await getMyProfile();
      if (cancelled || !p || !supabase) return;
      const channel = supabase.channel(PRESENCE_CHANNEL, {
        config: { presence: { key: p.id } },
      });
      channel.subscribe(async (status) => {
        if (cancelled || status !== "SUBSCRIBED") return;
        await channel.track({
          userId: p.id,
          name: p.nickname?.trim() || p.email,
          avatarPath: p.avatar_path,
          device: "スマホ",
          app: "mobile",
          joinedAt: new Date().toISOString(),
        });
        // 最終アクセス時刻を記録（「最近のアクセス」表示用）。失敗は無視。
        void touchMyLastActiveAt().catch(() => {});
      });
      // 5分ごとに last_active_at を更新（利用中の目安）。
      const heartbeat = window.setInterval(() => {
        void touchMyLastActiveAt().catch(() => {});
      }, LAST_ACTIVE_HEARTBEAT_MS);
      cleanup = () => {
        window.clearInterval(heartbeat);
        channel.untrack().catch(() => {});
        supabase!.removeChannel(channel);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}

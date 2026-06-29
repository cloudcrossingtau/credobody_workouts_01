import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getMyProfile } from "@/lib/profile";

const PRESENCE_CHANNEL = "credobody-presence";

// ログイン中、自分の在席を presence チャンネルに track する（全認証ページに常駐）。
// 「開発」タブ(/developer)では OnlineUsers が track+購読を担うため、ここはスキップ
// （同一チャンネルの重複作成による自分自身の消失を避ける）。
export function PresenceTracker() {
  useEffect(() => {
    if (!supabase) return;
    if (
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/developer")
    ) {
      return;
    }
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
          device: "PC",
          app: "admin",
          joinedAt: new Date().toISOString(),
        });
      });
      cleanup = () => {
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

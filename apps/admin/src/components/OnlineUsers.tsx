import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getMyProfile, getAvatarUrl } from "@/lib/profile";
import { Avatar } from "@/components/Avatar";

const PRESENCE_CHANNEL = "credobody-presence";

type Entry = {
  userId: string;
  name: string | null;
  avatarPath: string | null;
  device: string;
  app: string;
  joinedAt: string;
};

function appLabel(app: string): string {
  return app === "mobile" ? "アプリ" : app === "admin" ? "管理画面" : app;
}
function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 現在オンラインのユーザー一覧（Realtime Presence）。デプロイ前に利用者がいるか確認する用途。
// このコンポーネント自身も track するので、開いている自分も一覧に出る。
export function OnlineUsers() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [connected, setConnected] = useState(false);

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
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState() as Record<string, Entry[]>;
          const list: Entry[] = [];
          for (const key of Object.keys(state)) {
            const arr = state[key];
            if (arr && arr.length > 0) list.push(arr[0]);
          }
          list.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
          setEntries(list);
        })
        .subscribe(async (status) => {
          if (cancelled) return;
          setConnected(status === "SUBSCRIBED");
          if (status !== "SUBSCRIBED") return;
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

  return (
    <section className="mb-8 rounded-2xl border border-card-border bg-card-bg p-4">
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            connected ? "bg-emerald-500" : "bg-slate-300"
          }`}
        />
        <h3 className="text-[16px] font-semibold text-foreground">
          現在オンライン
        </h3>
        <span className="text-[14px] text-muted">{entries.length} 人</span>
      </div>
      <p className="mt-0.5 text-[12px] text-muted">
        いま利用中のユーザー。デプロイ前の確認に使えます。
      </p>

      {entries.length === 0 ? (
        <p className="mt-3 text-[14px] text-muted">
          現在オンラインのユーザーはいません。
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {entries.map((e, i) => (
            <div
              key={`${e.userId}-${i}`}
              className="flex items-center gap-2 rounded-full border border-card-border bg-background py-1 pl-1 pr-3"
            >
              <Avatar
                url={getAvatarUrl(e.avatarPath)}
                fallback={(e.name ?? "?").charAt(0).toUpperCase()}
                size={28}
              />
              <span className="text-[14px] font-medium text-foreground">
                {e.name ?? "（名称未設定）"}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                {appLabel(e.app)}
              </span>
              <span className="text-[11px] text-muted">{hhmm(e.joinedAt)}〜</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

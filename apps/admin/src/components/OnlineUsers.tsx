import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getMyProfile,
  getAvatarUrl,
  displayName,
  listAllProfiles,
  touchMyLastActiveAt,
  type Profile,
} from "@/lib/profile";
import { Avatar } from "@/components/Avatar";

const PRESENCE_CHANNEL = "credobody-presence";
const LAST_ACTIVE_HEARTBEAT_MS = 5 * 60 * 1000;

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

// オンライン中の「○前から」表示。
function sinceLabel(joinedAt: string): string {
  const sec = Math.floor((Date.now() - new Date(joinedAt).getTime()) / 1000);
  if (sec < 60) return `${sec}秒前から`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分前から`;
  const hour = Math.floor(min / 60);
  return `${hour}時間前から`;
}

// オフライン中の last_active_at 用「○前まで」表示。
function untilLabel(lastActiveAt: string): string {
  const sec = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 1000);
  if (sec < 60) return `${sec}秒前まで`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分前まで`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}時間前まで`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}日前まで`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week}週間前まで`;
  const month = Math.floor(day / 30);
  return `${month}ヶ月前まで`;
}

// 現在オンライン（Realtime Presence）＋最近のアクセス（last_active_at）。
// このコンポーネント自身も track するので、開いている自分もオンラインに出る。
export function OnlineUsers() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [connected, setConnected] = useState(false);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);

  const fetchProfiles = useCallback(async () => {
    try {
      setAllProfiles(await listAllProfiles());
    } catch (e) {
      console.warn("[OnlineUsers] listAllProfiles failed", e);
    }
  }, []);

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
        .on("presence", { event: "leave" }, () => {
          // 誰かがオフラインになったら profiles を再取得して「最近のアクセス」に反映。
          void fetchProfiles();
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
          void touchMyLastActiveAt().catch(() => {});
        });
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
  }, [fetchProfiles]);

  // プロフィール一覧を取得（最終アクセス時刻表示用）。1分ごとに再取得して表示を更新。
  useEffect(() => {
    fetchProfiles();
    const id = window.setInterval(fetchProfiles, 60 * 1000);
    return () => window.clearInterval(id);
  }, [fetchProfiles]);

  const onlineUserIds = useMemo(
    () => new Set(entries.map((e) => e.userId)),
    [entries],
  );
  const profileById = useMemo(
    () => new Map(allProfiles.map((p) => [p.id, p])),
    [allProfiles],
  );

  // オフライン中だが last_active_at が記録されているユーザー（最近のアクセス）。
  // ページ遷移の一瞬の切断で「オフライン」に見えないよう、直近15秒はアクティブ扱いで除外。
  const recentOffline = useMemo(() => {
    const recentThreshold = Date.now() - 15 * 1000;
    const offline = allProfiles.filter((p) => {
      if (onlineUserIds.has(p.id)) return false;
      if (
        p.last_active_at &&
        new Date(p.last_active_at).getTime() > recentThreshold
      ) {
        return false;
      }
      return true;
    });
    offline.sort((a, b) => {
      if (a.last_active_at && b.last_active_at)
        return b.last_active_at.localeCompare(a.last_active_at);
      if (a.last_active_at) return -1;
      if (b.last_active_at) return 1;
      return 0;
    });
    return offline;
  }, [allProfiles, onlineUserIds]);

  return (
    <div className="max-w-3xl">
      <div className="mb-3 flex items-center gap-2">
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

      {entries.length === 0 ? (
        <p className="rounded-xl border border-card-border bg-card-bg p-6 text-center text-[14px] text-muted">
          現在オンラインのユーザーはいません。
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e, i) => {
            const p = profileById.get(e.userId);
            const name = p ? displayName(p) : (e.name ?? "（名称未設定）");
            const avatarPath = p?.avatar_path ?? e.avatarPath;
            return (
              <li
                key={`${e.userId}-${i}`}
                className="flex items-center gap-3 rounded-xl border border-card-border bg-card-bg p-4"
              >
                <Avatar
                  url={getAvatarUrl(avatarPath)}
                  fallback={name.charAt(0).toUpperCase()}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-foreground">
                    {name}
                  </p>
                  <p className="truncate text-[13px] text-muted">
                    {appLabel(e.app)} ・ {sinceLabel(e.joinedAt)}
                  </p>
                </div>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
              </li>
            );
          })}
        </ul>
      )}

      {recentOffline.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-3 text-[16px] font-semibold text-foreground">
            最近のアクセス
          </h3>
          <ul className="space-y-2">
            {recentOffline.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-card-border bg-card-bg p-4"
              >
                <Avatar
                  url={getAvatarUrl(p.avatar_path)}
                  fallback={displayName(p).charAt(0).toUpperCase()}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-foreground">
                    {displayName(p)}
                  </p>
                  <p className="truncate text-[13px] text-muted">
                    {p.last_active_at ? untilLabel(p.last_active_at) : "未アクセス"}
                  </p>
                </div>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-6 text-[12px] text-muted">
        ※ オンラインはリアルタイム。「最近のアクセス」は約1分ごとに更新。タブを閉じる・画面ロック等でオフライン扱いになります。
      </p>
    </div>
  );
}

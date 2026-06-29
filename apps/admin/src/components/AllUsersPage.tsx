import { useEffect, useState } from "react";
import { pullAllUsers, type UserData } from "@/lib/devData";
import { getAvatarUrl, roleLabel } from "@/lib/profile";

function userName(u: UserData): string {
  return u.nickname?.trim() || u.email?.split("@")[0] || "（名称未設定）";
}
function initial(u: UserData): string {
  return userName(u).charAt(0).toUpperCase();
}
function fmtVal(unit: "time" | "count", v: number): string {
  return unit === "time" ? `${v}分` : `${v}回`;
}

// 開発者専用: 全ユーザーのデータを閲覧（誰がどんな項目をどれだけ登録しているか把握する）。
// 読み取り専用。編集は今後追加予定。
export function AllUsersPage() {
  const [users, setUsers] = useState<UserData[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setUsers(null);
    try {
      setUsers(await pullAllUsers());
    } catch (e) {
      console.warn("[all-users] failed:", e);
      setError("読み込みに失敗しました。権限（開発者）と通信状況を確認してください。");
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[20px] font-semibold text-foreground">全ユーザー</h2>
        <button
          onClick={load}
          className="rounded-lg border border-slate-300 bg-card-bg px-3 py-1.5 text-[14px] font-medium text-slate-700 hover:bg-slate-50"
        >
          更新
        </button>
      </div>
      <p className="mb-5 text-[13px] text-muted">
        全ユーザーの登録データを閲覧できます（開発者のみ）。現在は閲覧専用です。
      </p>

      {error && <p className="text-[15px] text-red-600">{error}</p>}
      {!users && !error && (
        <p className="py-16 text-center text-[15px] text-muted">読み込み中…</p>
      )}

      {users && (
        <>
          <p className="mb-3 text-[13px] text-muted">
            登録ユーザー {users.length} 名
          </p>
          <div className="space-y-4">
            {users.map((u) => {
              const avatarUrl = getAvatarUrl(u.avatarPath);
              return (
                <section
                  key={u.id}
                  className="overflow-hidden rounded-2xl border border-card-border bg-card-bg"
                >
                  {/* ユーザーヘッダー */}
                  <div className="flex items-center gap-3 border-b border-card-border px-4 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-light">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-[16px] font-bold text-accent">
                          {initial(u)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-foreground">
                        {userName(u)}
                      </p>
                      <p className="truncate text-[13px] text-muted">
                        {u.email ?? "-"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-medium text-slate-700">
                      {roleLabel(u.role)}
                    </span>
                  </div>

                  {/* 項目ごとのサマリ */}
                  {u.items.length === 0 ? (
                    <p className="px-4 py-4 text-[14px] text-muted">
                      登録項目・記録はありません。
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {u.items.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center gap-3 px-4 py-2.5"
                        >
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: it.color }}
                          />
                          <span className="min-w-0 flex-1 truncate text-[15px] text-foreground">
                            {it.name}
                            <span className="ml-2 text-[12px] text-muted">
                              {it.unit === "time" ? "時間（分）" : "種目数（回）"}
                            </span>
                          </span>
                          <span className="hidden shrink-0 text-right text-[13px] text-slate-700 sm:block">
                            直近7日 {fmtVal(it.unit, it.total7)}
                          </span>
                          <span className="hidden shrink-0 text-right text-[13px] text-muted md:block">
                            総計 {fmtVal(it.unit, it.totalAll)}
                          </span>
                          <span className="shrink-0 text-right text-[12px] text-muted">
                            {it.count}日
                            <br />
                            {it.lastDate ? `〜${it.lastDate.slice(5)}` : "記録なし"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

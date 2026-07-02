-- ============================================================
-- お知らせ配信（announcements）＋既読管理（announcement_reads）
--
--   announcements       : 運営からの告知（メンテ予告・新機能・既知不具合など）
--   announcement_reads  : ユーザーごとの既読記録（未読バッジ用）
--
-- 公開: is_published=true かつ ends_at が未来（or null）を全員閲覧可。
-- 管理者(admin/developer)は下書き含め全件閲覧＋CRUD。
-- ============================================================

-- ---------- announcements ----------
create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null,
  is_published boolean not null default false,
  -- 公開終了時刻。null なら無期限。過ぎたら自動で非表示（メンテ予告など）。
  ends_at      timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_announcements_published_created
  on public.announcements (created_at desc)
  where is_published = true;

alter table public.announcements enable row level security;

-- SELECT: 管理者は全件、一般は「公開中かつ未終了」のみ
drop policy if exists "announcements 閲覧" on public.announcements;
create policy "announcements 閲覧" on public.announcements
  for select using (
    public.is_admin()
    or (is_published = true and (ends_at is null or ends_at > now()))
  );

-- INSERT / UPDATE / DELETE: 管理者のみ
drop policy if exists "announcements 管理者作成" on public.announcements;
create policy "announcements 管理者作成" on public.announcements
  for insert with check (public.is_admin());

drop policy if exists "announcements 管理者更新" on public.announcements;
create policy "announcements 管理者更新" on public.announcements
  for update using (public.is_admin());

drop policy if exists "announcements 管理者削除" on public.announcements;
create policy "announcements 管理者削除" on public.announcements
  for delete using (public.is_admin());

-- updated_at 自動更新
create or replace function public.announcements_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_announcements_updated_at on public.announcements;
create trigger trg_announcements_updated_at
  before update on public.announcements
  for each row
  execute function public.announcements_set_updated_at();

-- ---------- announcement_reads（既読） ----------
create table if not exists public.announcement_reads (
  user_id         uuid not null references auth.users(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

alter table public.announcement_reads enable row level security;

-- 自分の既読履歴のみ閲覧・作成・削除可
drop policy if exists "announcement_reads 本人閲覧" on public.announcement_reads;
create policy "announcement_reads 本人閲覧" on public.announcement_reads
  for select using (user_id = auth.uid());

drop policy if exists "announcement_reads 本人作成" on public.announcement_reads;
create policy "announcement_reads 本人作成" on public.announcement_reads
  for insert with check (user_id = auth.uid());

drop policy if exists "announcement_reads 本人削除" on public.announcement_reads;
create policy "announcement_reads 本人削除" on public.announcement_reads
  for delete using (user_id = auth.uid());

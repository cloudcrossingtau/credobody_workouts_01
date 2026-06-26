-- ============================================================
-- CredoBody（training-app）ベーススキーマ
--   profiles          … ユーザー設定（role / 週開始曜日 など）
--   training_items    … トレーニング項目（縦軸。unit=time/count）
--   training_records  … 日々の実績（time:分 / count:回）
-- すべて user_id 所有 + RLS（本人のみ読み書き）。
-- 将来のトレーナー⇔利用者の相互参照は、別マイグレーションで
-- 紐付けテーブル＋SELECTポリシーを追加して拡張する。
-- ============================================================

create extension if not exists pgcrypto; -- gen_random_uuid()

-- ---------- profiles ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  role       text not null default 'client' check (role in ('client', 'trainer')),
  nickname   text,
  week_start smallint not null default 1 check (week_start between 0 and 6), -- 0=日..6=土
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles 本人参照" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles 本人更新" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- INSERT は handle_new_user（SECURITY DEFINER）が行うため通常ポリシー不要。

-- 新規ユーザー作成時に profiles を自動生成
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- training_items ----------
create table if not exists public.training_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  color      text not null default '#3b82f6',
  unit       text not null default 'time' check (unit in ('time', 'count')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_training_items_user
  on public.training_items (user_id, sort_order);

alter table public.training_items enable row level security;

create policy "items 本人 select" on public.training_items
  for select using (auth.uid() = user_id);
create policy "items 本人 insert" on public.training_items
  for insert with check (auth.uid() = user_id);
create policy "items 本人 update" on public.training_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "items 本人 delete" on public.training_items
  for delete using (auth.uid() = user_id);

-- ---------- training_records ----------
create table if not exists public.training_records (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id    uuid not null references public.training_items (id) on delete cascade,
  date       date not null,
  value      integer not null check (value >= 0), -- time:分 / count:回（item.unit で解釈）
  updated_at timestamptz not null default now(),
  unique (user_id, item_id, date)
);

create index if not exists idx_training_records_user_date
  on public.training_records (user_id, date);

alter table public.training_records enable row level security;

create policy "records 本人 select" on public.training_records
  for select using (auth.uid() = user_id);
create policy "records 本人 insert" on public.training_records
  for insert with check (auth.uid() = user_id);
create policy "records 本人 update" on public.training_records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "records 本人 delete" on public.training_records
  for delete using (auth.uid() = user_id);

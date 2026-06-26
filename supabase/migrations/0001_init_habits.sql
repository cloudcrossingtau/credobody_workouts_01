-- 習慣チェックアプリ 初期スキーマ
-- habit_lists（タブ/分類） > habits（習慣） > habit_checks（日々の実績）

-- ============ テーブル ============

create table if not exists habit_lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  list_id     uuid references habit_lists (id) on delete set null,
  name        text not null,
  emoji       text not null default '✅',
  color       text not null default '#3b82f6',
  sort_order  int  not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists habit_checks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  habit_id    uuid not null references habits (id) on delete cascade,
  date        date not null,
  memo        text,
  created_at  timestamptz not null default now(),
  -- 「その日・その習慣」のチェックは1件まで（存在＝チェック済み）
  unique (habit_id, date)
);

create index if not exists idx_habits_user        on habits (user_id);
create index if not exists idx_checks_user_date    on habit_checks (user_id, date);
create index if not exists idx_checks_habit        on habit_checks (habit_id);

-- ============ RLS（自分のデータのみ） ============

alter table habit_lists  enable row level security;
alter table habits       enable row level security;
alter table habit_checks enable row level security;

create policy "own habit_lists" on habit_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own habits" on habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own habit_checks" on habit_checks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

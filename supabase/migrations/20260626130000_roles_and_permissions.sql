-- ============================================================
-- ロール体系（招待制・権限）
--   general   … 一般（自分の記録の登録・閲覧のみ）
--   admin     … 管理者（ユーザー招待などの管理機能。データは自分のみ）
--   developer … 開発者（全データの参照・修正＋全管理機能）
--   trainer   … 将来用（複数トレーニーのデータ参照）。今は未使用。
-- ============================================================

-- 既存 role 制約・既定を入れ替え（baseline は client/trainer だった）
alter table public.profiles alter column role drop default;
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles
  set role = 'general'
  where role is null or role not in ('general', 'admin', 'developer', 'trainer');
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('general', 'admin', 'developer', 'trainer'));
alter table public.profiles alter column role set default 'general';

-- 権限判定ヘルパー（SECURITY DEFINER で RLS をバイパス＝profilesポリシーの再帰回避）
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'developer')
  );
$$;

create or replace function public.is_developer() returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'developer'
  );
$$;

-- profiles: 管理者/開発者は全ユーザー参照可、開発者は全ユーザー更新可
create policy "profiles 管理者は全件参照" on public.profiles
  for select using (public.is_admin());
create policy "profiles 開発者は更新" on public.profiles
  for update using (public.is_developer()) with check (public.is_developer());

-- training_items / training_records: 開発者は全データの参照・修正
create policy "items 開発者は全件" on public.training_items
  for all using (public.is_developer()) with check (public.is_developer());
create policy "records 開発者は全件" on public.training_records
  for all using (public.is_developer()) with check (public.is_developer());

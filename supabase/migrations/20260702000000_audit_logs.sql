-- ============================================================
-- 監査ログ: 招待 / ユーザー削除 / 権限変更 を統一テーブルに記録する。
--   invite_user  : invite-user Edge Function が service role で INSERT
--   delete_user  : delete-user Edge Function が service role で INSERT
--   change_role  : profiles.role 変更時に DB トリガ (SECURITY DEFINER) が INSERT
--
-- 閲覧は admin / developer のみ (RLS)。INSERT は service role / SECURITY DEFINER
-- 経由のみで、通常クライアントからの改ざん・追記はできない (append-only)。
-- ============================================================

create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  -- 実行者。削除されても監査が残るよう FK は張らず email を非正規化保持。
  actor_id     uuid,
  actor_email  text,
  -- 操作種別: 'invite_user' | 'delete_user' | 'change_role' (将来拡張可)
  action       text not null,
  -- 対象 (主に user)
  target_type  text,
  target_id    uuid,
  target_label text,          -- 対象の可読ラベル (招待/削除メール等)
  detail       jsonb          -- 追加情報 (例: change_role の {from, to})
);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);
create index if not exists audit_logs_action_idx
  on public.audit_logs (action);

-- RLS: admin / developer のみ閲覧可。INSERT/UPDATE/DELETE ポリシーは作らない
-- (service role と SECURITY DEFINER トリガは RLS をバイパスして記録できる)。
alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs 管理者は閲覧" on public.audit_logs;
create policy "audit_logs 管理者は閲覧" on public.audit_logs
  for select using (public.is_admin());

-- ============================================================
-- 権限変更トリガ: profiles.role が変わったら audit_logs に記録する。
-- SECURITY DEFINER で auth.users からメールを引く (実行者・対象とも)。
-- 実行者はクライアント UPDATE なら auth.uid()、service role 経由だと null。
-- ============================================================
create or replace function public.log_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor        uuid := auth.uid();
  v_actor_email  text;
  v_target_email text;
begin
  if new.role is distinct from old.role then
    select email into v_actor_email from auth.users where id = v_actor;
    select email into v_target_email from auth.users where id = new.id;
    insert into public.audit_logs
      (actor_id, actor_email, action, target_type, target_id, target_label, detail)
    values
      (v_actor, v_actor_email, 'change_role', 'user', new.id, v_target_email,
       jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_role_change on public.profiles;
create trigger trg_log_role_change
  after update on public.profiles
  for each row
  execute function public.log_role_change();

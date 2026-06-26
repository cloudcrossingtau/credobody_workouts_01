-- ============================================================
-- プロフィール拡張: アバター画像
--   profiles.avatar_path … Storage 'avatars' バケット内のパス
--   Storage バケット 'avatars'（公開読み取り / 本人のみ書き込み）
-- ============================================================

alter table public.profiles add column if not exists avatar_path text;

-- 公開バケット作成
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 誰でも閲覧可（公開バケット）
create policy "avatars 公開閲覧"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- アップロードは本人のフォルダ（先頭が自分のuid）のみ
create policy "avatars 本人アップロード"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 更新・削除は所有者のみ
create policy "avatars 本人更新"
  on storage.objects for update
  using (bucket_id = 'avatars' and owner = auth.uid());

create policy "avatars 本人削除"
  on storage.objects for delete
  using (bucket_id = 'avatars' and owner = auth.uid());

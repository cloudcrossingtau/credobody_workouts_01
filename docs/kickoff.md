# training-app キックオフメモ（仮）

## 背景
- 現状はステークホルダーが市販の「習慣チェックカレンダー」アプリを使い、手動でチェックしているだけ。
- 使い勝手の不満から自作を検討。まずは Web アプリ（Vercel デプロイ）として作る。
- 構成は既存の nouker（Astro + React + Supabase）を踏襲。

## 技術構成
- フロント: Astro 6 + React（islands）+ Tailwind v4
- データ: Supabase（PostgreSQL + Auth + RLS）※現状の試作は localStorage
- 開発: Docker（`apps/start_docker.sh`）。コンテナ内 dev サーバーを `--host 0.0.0.0`。
  - PC: http://localhost:4323
  - 実機: http://<PCのLAN IP>:4323
- 本番: Vercel（静的ビルド、アダプタ不要）

## 実装済み（MVP・localStorage）
- 週間カレンダー（習慣 × 7日グリッド）
- ワンタップでチェック（色付き✓）
- 習慣ごとの絵文字・色、週次カウント（X/7）
- 週の切替（前後 / 今週）、今日のハイライト
- 習慣の追加・削除、ダークモード、localStorage 永続化

## 次の検討事項
- Supabase 連携（`supabase/migrations/0001_init_habits.sql` 適用 → localStorage から差し替え）
- 認証（メール/パス。Supabase Auth）
- タブ（リスト分類）、レポート（継続日数・達成率）、月間ビュー
- ネイティブ化が必要なら Capacitor（通知・ウィジェット）。その際は
  `astro.config.mjs` を `build: { format: "file" }` に変更。

## 未決定
- プロダクト名 / ディレクトリ名（現在は仮）
- 対象プラットフォーム（Web のみか、将来アプリ化するか）

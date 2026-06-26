# training-app（仮称）

トレーニング／習慣の記録 Web アプリ。週間カレンダーに日々のチェックを記録する。
※ ディレクトリ名・プロダクト名は後でステークホルダーが決定する想定の仮名。

## フォルダ構成

```
training-app/
  apps/
    mobile-web/   Astro + React の Web アプリ（Vercel デプロイ想定）
    start_docker.sh / stop_docker.sh
  supabase/       Supabase スキーマ（migrations）・seed
  docs/           参考資料・仕様メモ
  scripts/        運用スクリプト置き場
```

## 開発（Docker / localhost）

nouker と同じく Docker で開発する。コンテナ内で Astro dev サーバーを
`--host 0.0.0.0` で起動するため、PC からは localhost、実機からは PC の
LAN IP（例 `http://192.168.x.x:4323`）でアクセスできる。

```bash
# 起動
cd apps && ./start_docker.sh
#   → http://localhost:4323  （実機は http://<PCのIP>:4323）

# 停止
cd apps && ./stop_docker.sh
```

Docker を使わずローカル直実行する場合:

```bash
cd apps/mobile-web
npm install
npm run dev -- --host 0.0.0.0
```

## 環境変数

`apps/mobile-web/.env` に設定（`.env.example` をコピーして使う）:

```
PUBLIC_SUPABASE_URL=<Supabase Project URL>
PUBLIC_SUPABASE_ANON_KEY=<Supabase Anon Key>
```

Vercel 本番デプロイでは Vercel Dashboard 側の環境変数が使われる。

## 本番（Vercel）

`apps/mobile-web` を Astro の静的ビルド（`npm run build` → `dist/`）として
Vercel にデプロイする。アダプタ不要（静的出力）。

## 現状

- カレンダー × ワンタップチェックの MVP を実装済み（データは現在 localStorage 保存）。
- Supabase 連携は `supabase/migrations` のスキーマを適用後に差し替え予定。
- ネイティブアプリ化（Capacitor）が必要になった場合は `astro.config.mjs` の
  出力を `build.format: "file"` に変更する（ディレクトリ URL が WebView で
  解決されないため）。

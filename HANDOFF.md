# 引き継ぎメモ — CredoBodyXXXX（旧仮称 training-app）

> 別チャットからの引き継ぎ用ドキュメント。このプロジェクトで作業を再開する際、
> まずこれを読めば経緯・現状・次の一手が分かるようにまとめてある。
>
> **プロダクト名（2026-06-26 決定）**: 既存の **CredoBody シリーズ**の1つとして
> **`CredoBodyXXXX`** にする（`XXXX` は未定）。`XXXX` が決まったタイミングで
> **ワークスペース名／ディレクトリ名を `training-app` から変更**する予定。
> ブランド素材: `~/Desktop/イメージサンプル/CredoBody`（CredoBody シリーズのデザイン画像）。

## 1. このプロジェクトは何か

- ステークホルダー（本人）が市販の「習慣チェックカレンダー」アプリを使い、
  日々のトレーニング/習慣を手動でチェックしている。使い勝手の不満から自作を検討。
- まず **Web アプリ（Vercel デプロイ）** として作る。
- 技術構成は既存の **nouker（Astro + React + Supabase）** を踏襲。
- 当初「トレーニング管理アプリ」を検討 → 一旦「習慣チェックカレンダー」型の MVP を作成。
  その後ステークホルダーとの再協議で **「トレーニング記録アプリ」として再設計する方針に確定**
  （縦軸＝トレーニング項目、記録は実施時間）。

### 確定した方針（2026-06-25 ステークホルダー協議）
- **まず Web アプリで進める**。仕様が固まり必要になったらネイティブ化を検討。
- **ネイティブ化（Capacitor）の目的は「電波」**。トレーニング場所が電波の届かない高地
  （国内外）になり得るため、オフラインで使える形にしたい、というのが主動機。
  ※ HealthKit 等が理由ではない。
- **HealthKit 連携は当面なし**。健康データを使うなら専用デバイス想定で、
  スマホ / Apple Watch 連携の方向ではない。

## 2. 現在の状態（実装済み）

`apps/mobile-web` に実装。**ビルド確認済み**。本体 `components/HabitCalendar.tsx`
（default export は `TrainingLog`）。

**トレーニング記録グリッド（再設計フェーズ1 実装済み 2026-06-25）**
- 縦軸＝**トレーニング項目**（seed: ラン / バイク / 脚 / 腕 / 腹筋 / 背筋）。
- **項目ごとに記録の「単位」を持つ**（`Item.unit: "time" | "count"`、設定画面で変更可）。
  - `time`=実施時間（分入力 / グラフは h）。seed: ラン・バイク。
  - `count`=**種目数**（回入力）。seed: 脚・腕・腹筋・背筋。
  - データ型: `Minutes = Record<"itemId:YYYY-MM-DD", number>`（値の意味は項目の unit で決まる）。
    LS キーは互換のため `training.minutes.v1` のまま。単位未設定の旧データは `defaultUnit(name)`
    （ラン/バイク→time, それ以外→count）で補完。
  - セル入力モーダルは unit で出し分け（time: 分・クイック15/30/45/60/90、count: 回・クイック1〜5）。
- **記録タブはスクロール方式のみ**（種目名カラムは `sticky left-0` で固定、日付部分だけ横スクロール）。
  範囲は「最古の記録日 〜 今日」、最大 `GRID_PAST_DAYS`(=180) 日前まで遡って入力可。
  開いた時/「今日へ」で右端(today)へ。`gridScrollRef`、列幅 `NAME_W`/`CELL_W`。
  ※ 週表示版/PageView風カルーセル/スワイプ、旧 `winStart` 方式はいずれも廃止
  （ステークホルダー判断で「スクロール方式」に確定）。
- 行ごとに**直近7日の合計**を表示（time→`Xh` / count→`X回`）。週末は曜日色分け、今日と週開始日に区切り。
- **データは localStorage 保存**（Supabase 未連携）。
  - キー: `training.items.v1`（項目） / `training.minutes.v1`（記録） /
    `training.weekStart.v1`（週開始曜日 0=日..6=土）。

**ナビゲーション（2026-06-25 ステークホルダー要望で変更）**
- 画面右上のボタン（設定 ⚙️ / グラフ 📊 / ダーク切替 🌙）は**廃止**。
- 代わりに **nouker 風の下部固定タブバー**で切替（記録 / グラフ / 設定）。
  `view: "grid" | "charts" | "settings"` を切り替えるだけの単一 React アイランド内タブ
  （`tabBar` を全ビュー共通で描画。各ビューは下端が隠れないよう `pb-24`）。
- **ダークモード切替は廃止**（要望）。`BaseLayout.astro` のダーク反映スクリプトも削除し
  **明色固定**。マークアップの `dark:` クラスは残置（非アクティブ。将来 OS 連動等で再活用可）。

**設定画面（再設計フェーズ2 実装済み 2026-06-25）**
- ルーティングは増やさず、**1つの React アイランド内でビュー切替**。
  Capacitor 化時のディレクトリURL問題を避けるため意図的にこうしている。
- 下部タブ「設定」で表示。
- **週の開始曜日**を 日〜土 から選択（既定=月）。グリッドの該当曜日に区切り線を表示し、
  将来のグラフ/週合計の集計境界にも使う想定（`weekStart` を保存）。
- **トレーニング項目**の追加・編集（名前=インライン入力 / 色=インラインピッカー /
  **記録の単位（時間 or 種目数）= セグメントトグル**）・並べ替え（▲▼）・削除（confirm 付き。記録も連動削除）。
  - ※ アイコン（絵文字）は廃止（ステークホルダー要望: 実項目が未確定のため）。
    項目の識別は**色のみ**。`Item` 型は `{ id, name, color, unit }`。

**グラフ画面（再設計フェーズ3 実装済み 2026-06-25）**
- 下部タブ「グラフ」で表示（同じ React アイランド内ビュー切替 `view: "charts"`）。
- 外部チャートライブラリは**未使用**（オフライン/CSP・依存削減のため div/CSS で自前描画）。
- **単位ごとにグラフを分割**（時間と種目数が混在すると見づらいため）。それぞれ日別・週別の
  計4グラフ（該当項目が無いグループは非表示）：
  - 「時間（h）・日別 / 週別」… time 項目の合計時間[h]。色 `TIME_COLOR`(青)。
  - 「種目数（回）・日別 / 週別」… count 項目の合計回数[回]。色 `COUNT_COLOR`(緑)。
- **色分け（項目別の積み上げ）は廃止**。各グラフは**単色の合計バー**。凡例も廃止。
- 共通描画は `renderBarChart(cols, color, fmt, barW, scrollRef)`。**横スクロール**（最古の記録〜今日/今週）。
  **Y軸は固定列（スクロール外）**、右の `overflow-x-auto` 領域でバーだけスクロール。開いた時に右端へ。
  自動スクロール ref: `timeDailyRef`/`timeWeeklyRef`/`countDailyRef`/`countWeeklyRef`。
- ※ 各画面の小さな説明文（グレーのヒント）はステークホルダー要望で撤去済み。
- 目盛りは `niceScale()` で自動。週の開始日は `startOfWeek(d, weekStart)`。
- **デモ用データ**: 初回起動時は `seedMinutes()` で過去42日ぶんを自動投入。設定「データ」に
  「デモ用データを投入」「全記録を削除」ボタンあり（既存環境でも投入/初期化できる）。

### ステークホルダーの要望（現行アプリの不満点・反映方針）
1. **時間を入力したい** → 分で入力・グラフは時間[h]表示で実装（フェーズ1で入力は対応済み）。
2. **週初めの曜日を変更したい**（平日=月曜始まり希望）→ **設定画面**で（フェーズ2）。
3. **結果をグラフで見たい** → 日別グラフ / 週別グラフ（フェーズ3）。
4. **画面内での項目追加は不要** → in-grid の追加/編集UIは撤去済み。項目は**設定画面**で登録（フェーズ2）。
5. 縦軸はトレーニング項目（フェーズ1で対応済み）。

Supabase 連携の土台は用意済み（未接続）:
- クライアント雛形: `apps/mobile-web/src/lib/supabase.ts`
- スキーマ: `supabase/migrations/0001_init_habits.sql`
  （`habit_lists` > `habits` > `habit_checks`、RLS 付き）

## 3. 技術構成と注意点

| 項目 | 内容 |
|---|---|
| フロント | Astro 6 + React 19（islands）+ Tailwind v4 |
| **Node** | **22.12+ 必須**（Astro6 要件）。このマシンは nvm の v22 を使用 → `nvm use 22` |
| **重要な落とし穴** | `package.json` に **`"overrides": { "vite": "^7" }` が必須**。Astro6 がデフォルトで使う rolldown-vite が `@tailwindcss/vite` と非互換でビルドが落ちるため |
| データ | Supabase（PostgreSQL + Auth + RLS）予定。現状 localStorage |
| 開発 | Docker（`apps/start_docker.sh`）。コンテナ内 dev を `--host 0.0.0.0` |
| 本番 | Vercel に静的デプロイ（アダプタ不要） |
| パスエイリアス | `@/*` → `src/*`（tsconfig / astro.config に設定済み） |

## 4. 開発の始め方

```bash
# Docker で起動
cd apps && ./start_docker.sh
#   PC:   http://localhost:4323
#   実機: http://<PCのLAN IP>:4323   （Docker内で --host 0.0.0.0 起動）

# 停止
cd apps && ./stop_docker.sh

# Docker を使わずローカル直実行
cd apps/mobile-web
nvm use 22
npm install
npm run dev -- --host 0.0.0.0

# 本番ビルド確認
npm run build   # → dist/
```

環境変数は `apps/mobile-web/.env`（`.env.example` をコピー）:
```
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...
```
Vercel 本番では Vercel Dashboard 側の環境変数が使われる。

## 5. ディレクトリ構成

```
training-app/
├ README.md / HANDOFF.md（これ）
├ apps/
│  ├ start_docker.sh / stop_docker.sh
│  └ mobile-web/         Astro+React Webアプリ
│     ├ Dockerfile / docker-compose.yml（4323:4321）
│     ├ .env / .env.example / astro.config.mjs / package.json / tsconfig.json
│     └ src/{pages,layouts,components,lib,styles}
│        └ components/HabitCalendar.tsx   ← 本体
├ supabase/migrations/20260626120000_baseline_training.sql / seed.sql
└ docs/kickoff.md
```

## 6. 次のステップ（推奨順）

- ~~**フェーズ2: 設定画面**~~ ✅ 実装済み（第2節参照）。
- ~~**フェーズ3: グラフ2種**~~ ✅ 実装済み（第2節参照。手書きイメージ `apps/work/IMG_4022（大）.jpeg` 準拠）。
- **フェーズ4: Supabase 連携 + 認証**（着手中 2026-06-26）
  - **dev/prod 分離**は nouker と同方式：**ホスト型 Supabase を2プロジェクト**作成し、
    `.env` の `PUBLIC_SUPABASE_URL/ANON_KEY`（既定=dev）と `_PROD` 控えを env で切替。
    Vercel 本番は Dashboard の env vars（=prod）を使用。ローカルSupabaseスタックは使わない。
  - **方針（ステークホルダー確定）**: ①保存は**ローカル優先＋オンライン時に同期**（電波対策）。
    ②**ユーザー登録(signup)＋メール/パスログイン**。③将来トレーナー⇔利用者の相互参照
    （`role: client/trainer` + 紐付け）→ 設計は**最初から user_id 所有＋RLS**。
  - **スキーマ作成済み**: `supabase/migrations/20260626120000_baseline_training.sql`
    （`profiles`(role/week_start) / `training_items`(unit) / `training_records`、
    全テーブル user_id 所有の RLS、新規ユーザートリガー `handle_new_user`）。旧 habit схема削除。
  - dev/prod 作成・`.env` 設定・`db push`（baseline）まで完了。dev=`mohlrepvnpnycljwppxm` /
    prod=`tnwzjipfzpxtkqwijrtc`。
  - **認証（4a 実装済み）**: `AuthScreen`（ログイン/登録）＋ `HabitCalendar` の認証ゲート。
    セッションは supabase-js が localStorage 保持＝一度ログインすればオフライン維持。
  - **招待制＋ロール（実装済み 2026-06-26）**:
    - ロール: `general`(一般) / `admin`(管理者=招待など) / `developer`(全データ＋全管理) /
      `trainer`(将来用・未使用)。判定は `is_admin()`/`is_developer()`（SECURITY DEFINER）。
      開発者は training_items/records を全件アクセス可（RLSポリシー）。
    - 招待: Edge Function `supabase/functions/invite-user`（admin/developer のみ、
      service_role で `inviteUserByEmail`）。設定タブに招待UI（admin/developer表示）。
    - 公開signup無効化: `PUBLIC_DISABLE_SIGNUP=true`（UI非表示）＋ Supabase Auth でも
      signup無効化が必要。招待リンク→ `SetPasswordScreen` で初回パスワード設定。
    - ★ 要手動: prod へ roles migration push / 各プロジェクトに invite-user deploy /
      Auth で signup無効化＋Redirect URL 登録 / 最初の developer を手動設定。
  - 残：**(d) ローカル⇔Supabase 同期層**（localStorage を維持しつつ同期）＝次の実装。
- **本人に見せて FB**。
- （必要なら）**Capacitor でネイティブ化**（主目的=オフライン/電波対策）。
  - ★ Capacitor 化時は `astro.config` を `build: { format: "file" }` に（第7節参照）。

## 7. これまでの調査で判明した重要知見（別チャットの成果）

ネイティブアプリ化を検討した際に検証済みの知見。今後アプリ化する場合に有用:

- **Capacitor ラッパーは実証済み**。Astro 静的ビルドを Capacitor で包み、
  **iOS 実機・シミュレータで動作確認済み**（成果物: `../work/capacitor-astro-test`）。
- ★ **Capacitor 化するなら `astro.config` を `build: { format: "file" }` に**。
  末尾スラッシュの `/calendar/`（ディレクトリURL）は Capacitor 内蔵サーバーが
  `index.html` に解決できず、**画面遷移が壊れる**。`/calendar.html` 形式が必要。
- **HealthKit 等のネイティブ機能はプラグイン＋設定（Info.plist / entitlements）で実装可、
  Swift は原則不要**。ただし **HealthKit は有料 Apple Developer Program が必須**（無料不可）。
- **Apple 実機ビルドは署名が必要**。会社アカウント（CLOUD CROSSING / Team `T2DSURX436`）は
  PLA 同意が管理者依存で詰まりやすい。→ 個人有料アカウント（$99/年）を申請中。
  本人確認の住所は **ID（免許証）と一致が必要**（単身赴任先の住所だと弾かれる）。
- **ストレージ**: Web 開発自体は軽いが、ネイティブビルドすると Xcode/シミュレータ/Gradle が
  容量を食う（Flutter と同様）。`xcrun simctl delete unavailable` 等で対処。

## 8. 未決定事項

- プロダクト名の `XXXX` 部分（`CredoBodyXXXX`）。決定後にワークスペース名／
  ディレクトリ名（現 `training-app`）と、表示タイトル（`index.astro` / `BaseLayout` /
  `HabitCalendar.tsx` の "トレーニング記録"）を変更する。
- Web のみで行くか、将来ネイティブアプリ化するか
- 通知・ウィジェット（ネイティブ機能）の要否

## 9. 関連ディレクトリ（参考・本プロジェクト外）

- `../work/capacitor-astro-test` … Capacitor ラッパー検証（iOS 実機/シミュレータ動作確認・
  HealthKit 実装例）。アプリ化を進める際の参考。
- `../work/habit-calendar` … MVP の元になった試作（本プロジェクトへ移植済み。削除可）。
- `../nouker` … 構成の参考元。**本番稼働中なので触らない**。

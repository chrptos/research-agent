# research-agent

チーム向けの ChatGPT ライクなチャットアプリ。設計は [docs/design.md](docs/design.md) を参照。

**現在のフェーズ: P0（土台）** — ログイン、ストリーミングチャット、会話履歴、停止、タイトル自動生成。

## 技術スタック
- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Vercel AI SDK 7 + `@ai-sdk/google-vertex`（Gemini on Vertex AI）
- PostgreSQL + Drizzle ORM
- Auth.js v5（Google ログイン + 開発用ログイン）

## ローカル開発

```bash
cp .env.example .env
```

`.env` を編集する。GCP なしでまず動かすなら、次の3つを設定すれば足りる。

```
AUTH_SECRET=<npx auth secret で生成>
AUTH_DEV_LOGIN=true
LLM_MOCK=true
```

```bash
docker compose up -d
```

```bash
npm install
```

```bash
npm run db:migrate
```

```bash
npm run dev
```

http://localhost:3000 を開き、開発用ログインでログインする。

### Gemini（Vertex AI）を使う

1. GCP プロジェクトで Vertex AI API を有効にする。
2. ローカルの認証情報を作る。

   ```bash
   gcloud auth application-default login
   ```

3. `.env` に `GOOGLE_VERTEX_PROJECT=<プロジェクトID>` を設定し、`LLM_MOCK=false` にする。
4. 使うモデル ID は `NEXT_PUBLIC_GEMINI_FLASH_MODEL` / `NEXT_PUBLIC_GEMINI_PRO_MODEL` で上書きできる（Model Garden で最新の ID を確認）。

### Google ログインを使う

Google Cloud Console で OAuth クライアント（ウェブアプリ）を作り、リダイレクト URI に `http://localhost:3000/api/auth/callback/google` を登録する。`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` を設定し、`ALLOWED_EMAIL_DOMAINS` などでログインできる人を絞る。

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド（`output: standalone`） |
| `npm run typecheck` / `npm run lint` | 型チェック / Lint |
| `npm run db:generate` | スキーマ変更からマイグレーションを生成 |
| `npm run db:migrate` | マイグレーションを適用 |

## ディレクトリ

```
src/
  app/(chat)/        チャット画面（/ と /c/[id]）。レイアウトでログインを必須にする
  app/login/         ログイン画面
  app/api/chat/      ストリーミング応答の API
  components/        サイドバー、チャット UI
  lib/llm/           モデル一覧、プロバイダー切り替え、モック、タイトル生成
  lib/db/            Drizzle スキーマとクエリ
  lib/auth/          Auth.js 設定
drizzle/             マイグレーション
```

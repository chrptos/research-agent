# ChatGPTクローン 設計書 (v0.1)

> ステータス: ドラフト / 最終更新: 2026-11-17

## 1. 目的とスコープ

自分とチーム内で使う、ChatGPTのようなチャットアプリを作る。

| 項目 | 決定 |
|---|---|
| 利用者 | 自分とチームメンバー（数人〜数十人） |
| LLM | Google Cloud (Vertex AI) を使い、モデルは切り替えられるようにする |
| MVP機能 | チャット、ストリーミング表示、会話履歴、ファイル/画像添付、Web検索などのツール、RAG（ナレッジ） |
| 技術スタック | Next.js (App Router) + TypeScript |
| 実行基盤 | Google Cloud (Cloud Run + Cloud SQL + Cloud Storage) |

### 対象外（MVPでは作らない）
- 一般公開、課金、マルチテナント
- 音声入出力、画像生成
- モバイルアプリ（レスポンシブWebで対応する）

---

## 2. 全体アーキテクチャ

```
┌──────────────┐   HTTPS (SSE stream)   ┌───────────────────────────────┐
│  Browser     │ ─────────────────────▶ │  Cloud Run: Next.js app       │
│  (React UI)  │ ◀───────────────────── │  - UI (RSC / Client)          │
└──────┬───────┘                        │  - Route Handlers (/api/*)    │
       │ Signed URLでアップロード        │  - LLM Gateway (AI SDK)       │
       ▼                                │  - Tool実行 / RAG検索          │
┌──────────────┐                        └───┬─────────┬─────────┬──────┘
│ Cloud Storage│ ◀──────────────────────────┘         │         │
│ (添付ファイル) │                                      │         │
└──────┬───────┘                                      ▼         ▼
       │ イベント                         ┌───────────────┐ ┌──────────────────┐
       ▼                                  │ Cloud SQL     │ │ Vertex AI        │
┌──────────────┐  ベクトル書き込み          │ PostgreSQL    │ │ - Gemini         │
│ Cloud Run Job│ ────────────────────────▶ │ + pgvector    │ │ - Claude (Model  │
│ (取り込み処理) │                          └───────────────┘ │   Garden)         │
└──────────────┘                                            │ - Embeddings     │
       ▲ Cloud Tasks                                        │ - Google Search  │
                                                            │   Grounding      │
                                                            └──────────────────┘
```

**方針**
- アプリは Next.js 1つのモノリスにする。チーム規模ならマイクロサービスは過剰。
- 時間のかかる処理（RAGの取り込み）だけ非同期ジョブに分ける。
- Vertex AI の認証はサービスアカウント（Workload Identity）で行い、APIキーは持たない。

---

## 3. LLM抽象化レイヤー（モデル切り替え）

### 3.1 採用ライブラリ: Vercel AI SDK
- `@ai-sdk/google-vertex` で Gemini を、`@ai-sdk/google-vertex/anthropic` で Vertex AI 上の Claude を、同じ `streamText()` インターフェースで呼べる。
- ストリーミング、ツール呼び出し、マルチモーダル入力が共通APIで扱え、フロントの `useChat` とそのまま繋がる。
- 将来 OpenAI、Anthropic直、ローカルLLM（Ollama）を足すときも、プロバイダーを1つ追加するだけで済む。

### 3.2 モデルレジストリ
モデルはコードに直接書かず、設定ファイル（後で管理画面/DBにしてもよい）で管理する。

```ts
// src/lib/llm/models.ts
export type ModelSpec = {
  id: string;                 // アプリ内ID 例: "gemini-pro"
  provider: "vertex" | "vertex-anthropic" | "openai" | "ollama";
  modelId: string;            // プロバイダー側のID（環境変数で上書き可能）
  label: string;
  capabilities: {
    vision: boolean;
    pdf: boolean;
    tools: boolean;
    nativeWebSearch: boolean; // Google Search Grounding が使えるか
  };
  contextWindow: number;
  default?: boolean;
};
```

```ts
// src/lib/llm/registry.ts
import { createProviderRegistry } from "ai";
import { createVertex } from "@ai-sdk/google-vertex";
import { createVertexAnthropic } from "@ai-sdk/google-vertex/anthropic";

export const registry = createProviderRegistry({
  vertex: createVertex({ project: env.GCP_PROJECT, location: env.VERTEX_LOCATION }),
  "vertex-anthropic": createVertexAnthropic({ project: env.GCP_PROJECT, location: env.VERTEX_LOCATION }),
});

export const getModel = (spec: ModelSpec) =>
  registry.languageModel(`${spec.provider}:${spec.modelId}`);
```

- 会話ごとにモデルを選べるようにし、途中で切り替えてもよい（メッセージにどのモデルで生成したかを記録する）。
- `capabilities` を見て、UIで添付ボタンやツールを出し分ける。サーバー側でも同じ判定をする。
- 具体的なモデルID（Geminiの Pro / Flash 系、Claude の Sonnet / Haiku 系など）は、実装を始める時点で Vertex AI の Model Garden を見て決め、環境変数で上書きできるようにする。
- タイトル生成などの補助的な処理には、安くて速いモデル（Flash系）を固定で使う。

---

## 4. 機能設計

### 4.1 チャットとストリーミング
- `POST /api/chat` で `streamText()` を呼び、`toUIMessageStreamResponse()` でSSEとして返す。
- クライアントは `@ai-sdk/react` の `useChat` を使う。
- 流れ:
  1. ユーザーのメッセージをDBに保存する。
  2. 履歴を読み込む（コンテキストに収まるよう、古いものから切り捨てる。必要なら要約を挟む）。
  3. システムプロンプトとツール定義を組み立てて、ストリーミングを始める。
  4. `onFinish` でアシスタントのメッセージ（テキスト、ツール結果、出典、トークン数）を保存する。
- 停止ボタン: `AbortSignal` を伝播させ、そこまでに生成された部分を保存する。
- 再生成と編集: メッセージに `parent_id` を持たせ、ツリー構造で分岐を表す（ChatGPTの「< 2/3 >」と同じ動き）。MVPでは「最後の応答の再生成」だけ作ってもよい。
- 初回の応答のあと、非同期で会話タイトルを生成する。
- 表示: Markdown、コードのハイライト、数式（KaTeX）、コードのコピーボタン。

### 4.2 ファイルと画像の添付
- アップロード: `POST /api/uploads` で GCS の署名付きURLを発行し、ブラウザから直接 PUT する（アプリサーバーは通さない）。
- 対応形式: 画像（png/jpg/webp）、PDF、テキスト系（txt/md/csv/コード）。上限はまず 20MB / ファイルとする。
- モデルへの渡し方:
  - 画像とPDF: モデルが `vision` / `pdf` に対応していれば、ファイルのパーツとしてそのまま渡す（Vertex AI は `gs://` のURIをそのまま扱える）。
  - テキスト系: 中身を抽出してプロンプトに入れる。
  - コンテキストに入らない大きなファイル: 「この会話専用のナレッジ」として RAG に取り込み、検索して使う（4.4 と同じ仕組み）。
- 選んだモデルが対応していない形式なら、UIで警告し、テキスト抽出に切り替える。

### 4.3 Web検索とツール
ツールは「どのモデルでも動くこと」を優先して、自分たちで関数ツールとして実装する。

| ツール | 実装 | 備考 |
|---|---|---|
| `web_search` | Gemini Flash に **Google Search Grounding** を付けて呼び、要約と出典URLを返す | Claude など Grounding を持たないモデルからも、この関数ツール経由で使える |
| `fetch_url` | 指定URLを取得し、本文を抽出して返す | SSRF対策として、プライベートIPへのアクセスを禁止し、タイムアウトとサイズ上限を設ける |
| `search_knowledge` | RAG検索（4.4） | ナレッジベースが紐づいているときだけ有効にする |
| （将来）`run_code` | サンドボックス（Cloud Run Jobs や gVisor）でPythonを実行する | MVP対象外 |

- `stopWhen: stepCountIs(5)` などで、ツールを何周呼べるかに上限を設ける。
- UIには、ツールの実行状況（「検索中…」）と出典を表示する。
- Google Search Grounding の利用規約にある表示要件（検索候補の表示など）を、実装前に確認する。
- 拡張: MCPクライアントを入れて、外部のMCPサーバーをツールとして足せるようにしておく（将来）。

### 4.4 RAG（ナレッジ）
- **単位**: ナレッジベース（KB）を作り、そこへドキュメントを登録する。会話（または後述のアシスタント）に KB を紐づける。
- **取り込みの流れ**（非同期）:
  1. ファイルを GCS に置き、`documents` に `status=pending` で登録する。
  2. Cloud Tasks 経由で、Cloud Run Job（または `/api/internal/ingest`）を起動する。
  3. テキストを抽出する。PDF は pdf.js か Gemini で抽出し、表や図の多い PDF は Document AI も検討する。
  4. チャンクに分割する（約800トークン、重なり約100、見出しを境界として優先する）。
  5. Vertex AI の Embeddings（`gemini-embedding` 系、次元数は768に固定）でベクトル化する。
  6. `chunks` テーブル（pgvector）に保存し、`status=ready` にする。
- **検索**: ベクトル検索（HNSWインデックス、コサイン類似度）と全文検索（`tsvector`）を組み合わせるハイブリッド検索にし、RRF で順位を統合して上位8件程度を使う。日本語の全文検索は `pg_bigm` の利用を検討する。
- **回答**: `search_knowledge` ツールとしてモデルに渡し、モデルが必要だと判断したときに検索させる（エージェント型RAG）。チャンクのIDを出典として返し、UIで脚注として表示する。
- **将来の選択肢**: 規模や精度が足りなくなったら、Vertex AI RAG Engine か Vertex AI Search に置き換える。インターフェース（`KnowledgeRetriever`）を切っておく。

### 4.5 カスタムアシスタント（MVPの後でもよい）
- システムプロンプト、既定のモデル、有効にするツール、紐づける KB をまとめて「アシスタント」として保存する（ChatGPTのGPTsに相当）。
- データモデルには最初から `assistant_id` を持たせておく。

---

## 5. データモデル（PostgreSQL / Drizzle ORM）

```
users            (id, email, name, image, role[admin|member], created_at)
conversations    (id, user_id, title, model_id, assistant_id?, knowledge_base_ids[],
                  pinned, archived, created_at, updated_at)
messages         (id, conversation_id, parent_id?, role[user|assistant|system|tool],
                  parts jsonb,        -- AI SDK UIMessage parts (text/file/tool/source)
                  model_id?, usage jsonb?, status[streaming|done|error|aborted],
                  created_at)
attachments      (id, user_id, conversation_id?, gcs_uri, mime_type, size, filename,
                  extracted_text_uri?, created_at)
knowledge_bases  (id, owner_id, name, description, visibility[private|team], created_at)
documents        (id, knowledge_base_id, attachment_id, status[pending|processing|ready|error],
                  error?, chunk_count, created_at)
chunks           (id, document_id, knowledge_base_id, ordinal, content, tokens,
                  metadata jsonb, embedding vector(768), tsv tsvector)
                  -- INDEX: HNSW(embedding vector_cosine_ops), GIN(tsv)
assistants       (id, owner_id, name, system_prompt, model_id, tools[], knowledge_base_ids[],
                  visibility, created_at)
usage_logs       (id, user_id, conversation_id, model_id, input_tokens, output_tokens,
                  cost_usd, created_at)
```

- `messages.parts` を jsonb にして、AI SDK のメッセージ形式をそのまま保存する。変換の手間をなくすため。
- 自分の会話の一覧と検索は、`conversations(user_id, updated_at desc)` のインデックスで返す。
- KB の `visibility=team` で、チーム内での共有ができるようにする。

---

## 6. API設計（Next.js Route Handlers）

| Method | Path | 用途 |
|---|---|---|
| POST | `/api/chat` | メッセージを送り、ストリーミングで応答を受ける（`conversationId`, `message`, `modelId`） |
| GET | `/api/conversations` | 会話一覧（カーソルによるページング） |
| GET/PATCH/DELETE | `/api/conversations/:id` | 会話の取得、タイトル変更・ピン留め、削除 |
| GET | `/api/conversations/:id/messages` | メッセージ一覧 |
| POST | `/api/uploads` | 署名付きアップロードURLの発行 |
| GET/POST | `/api/knowledge-bases` | KBの一覧と作成 |
| POST | `/api/knowledge-bases/:id/documents` | ドキュメント追加（取り込みジョブを登録する） |
| GET | `/api/models` | 使えるモデルとその機能の一覧 |
| POST | `/api/internal/ingest` | 取り込みワーカー（Cloud Tasks からだけ呼べる。OIDC で検証する） |

会話一覧の読み込みなど、読み取りが中心のものは Server Components から直接DBを読んでもよい。

---

## 7. 画面構成

```
┌───────────────┬──────────────────────────────────────────┐
│ [+ 新しいチャット] │  モデル選択 ▼ [Gemini Pro]   KB: [社内Wiki ×] │
│               │──────────────────────────────────────────│
│ 今日           │                                          │
│  ・会話A        │   メッセージ一覧（Markdown/コード/出典）      │
│  ・会話B        │   🔍 Web検索中… → 出典 [1][2]              │
│ 昨日           │                                          │
│  ・会話C        │──────────────────────────────────────────│
│               │ [📎] メッセージを入力…       [🌐検索] [送信] │
│ ⚙ ナレッジ管理   │                                          │
└───────────────┴──────────────────────────────────────────┘
```

- `/` 新しいチャット、`/c/[id]` 会話、`/knowledge` KB管理、`/settings` 設定
- UIは shadcn/ui と Tailwind CSS で作る。ダークモードに対応する。

---

## 8. 非機能要件

| 観点 | 方針 |
|---|---|
| 認証 | Auth.js (NextAuth v5) の Google ログインにし、許可するドメインかメールのリストで制限する。Cloud Run に IAP を前段に置く案も検討する |
| 認可 | すべてのクエリに `user_id` の条件を付ける。KB は所有者か `team` 公開のものだけ読める |
| 秘密情報 | Vertex AI はサービスアカウントで認証する。そのほかの秘密は Secret Manager に置く |
| 性能 | 最初のトークンが返るまでの時間（TTFT）を重視する。Cloud Run のリクエストタイムアウトは300秒以上にし、最小インスタンスを1にしてコールドスタートを避ける（コストと相談して決める） |
| コスト | `usage_logs` でユーザー別、モデル別のトークン数を集計する。ユーザーごとに1日の上限を設定できるようにする |
| 監視 | Cloud Logging と Cloud Trace を使う。LLMのレイテンシ、エラー率、トークン数を記録する（Langfuse の導入も検討する） |
| データ | 会話と添付は削除できるようにする。GCS のライフサイクルで、使われなくなった添付を自動で消す |
| セキュリティ | `fetch_url` の SSRF 対策、アップロードの MIME 検証、プロンプトインジェクションへの注意（ツール結果をデータとして扱う） |

---

## 9. ディレクトリ構成（予定）

```
.
├── src/
│   ├── app/
│   │   ├── (chat)/page.tsx, c/[id]/page.tsx
│   │   ├── knowledge/ settings/
│   │   └── api/ chat/ conversations/ uploads/ knowledge-bases/ models/ internal/
│   ├── components/      # chat/, sidebar/, ui/ (shadcn)
│   ├── lib/
│   │   ├── llm/         # models.ts, registry.ts, prompts.ts, title.ts
│   │   ├── tools/       # web-search.ts, fetch-url.ts, search-knowledge.ts
│   │   ├── rag/         # chunker.ts, embed.ts, retriever.ts, ingest.ts
│   │   ├── storage/     # gcs.ts
│   │   ├── db/          # schema.ts, client.ts, queries/
│   │   └── auth/
│   └── env.ts           # zodで環境変数を検証する
├── drizzle/             # マイグレーション
├── infra/               # Terraform (Cloud Run, Cloud SQL, GCS, IAM)
├── docker-compose.yml   # ローカル用 Postgres + pgvector
└── docs/
```

---

## 10. 開発フェーズ

| Phase | 内容 | 完了の目安 |
|---|---|---|
| **P0 土台** | Next.js の雛形、Auth.js、Drizzle と Postgres（ローカルは docker）、Gemini 1モデルでのストリーミングチャット、会話履歴 | ログインして会話でき、リロードしても履歴が残る |
| **P1 モデル切替** | モデルレジストリ、Claude on Vertex の追加、UIでの選択、タイトル自動生成、停止と再生成 | 会話の途中でモデルを切り替えられる |
| **P2 添付** | GCS 署名付きURL、画像とPDFの入力、モデルの対応状況に応じた出し分け | 画像やPDFについて質問できる |
| **P3 ツール** | `web_search`（Grounding）、`fetch_url`、ツールの実行表示、出典表示 | 最新の情報を出典付きで答えられる |
| **P4 RAG** | KB管理画面、取り込みジョブ、ハイブリッド検索、`search_knowledge` | 登録した資料にもとづいて、出典付きで答えられる |
| **P5 デプロイと運用** | Terraform、Cloud Run へのデプロイ、使用量の集計と上限、監視 | チームメンバーが使い始められる |

---

## 11. 未決事項・要確認

1. **データの保存場所**: Vertex AI と Cloud SQL のリージョンを `asia-northeast1`（東京）にそろえるか。Claude on Vertex は使えるリージョンが限られるので確認する。
2. **使うモデル**: Gemini の Pro/Flash、Claude の Sonnet/Haiku から、最初に有効にするものを決める。Model Garden で Claude を有効にする手続きが必要。
3. **認証方式**: Auth.js の Google ログインにするか、IAP にするか。
4. **共有範囲**: 会話をチームに共有する機能（共有リンク）が要るか。
5. **予算**: 月額の上限の目安（インフラ費とAPI費）。
6. **PDFの解析精度**: 表や図の多い資料が多いなら Document AI を使うか。
```

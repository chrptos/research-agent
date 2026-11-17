/**
 * 利用できるモデルの一覧。
 * modelId は Vertex AI Model Garden の ID。環境変数で上書きできる。
 * ここはクライアントからも import されるので、サーバー専用の処理を書かないこと。
 */
export type ProviderId = "vertex" | "vertex-anthropic" | "mock";

export type ModelSpec = {
  id: string;
  provider: ProviderId;
  modelId: string;
  label: string;
  description: string;
  capabilities: {
    vision: boolean;
    pdf: boolean;
    tools: boolean;
    nativeWebSearch: boolean;
  };
  contextWindow: number;
};

export const MODELS: ModelSpec[] = [
  {
    id: "gemini-flash",
    provider: "vertex",
    modelId: process.env.NEXT_PUBLIC_GEMINI_FLASH_MODEL ?? "gemini-2.5-flash",
    label: "Gemini Flash",
    description: "速くて安い。普段使い向け",
    capabilities: { vision: true, pdf: true, tools: true, nativeWebSearch: true },
    contextWindow: 1_000_000,
  },
  {
    id: "gemini-pro",
    provider: "vertex",
    modelId: process.env.NEXT_PUBLIC_GEMINI_PRO_MODEL ?? "gemini-2.5-pro",
    label: "Gemini Pro",
    description: "難しい質問や長い文章向け",
    capabilities: { vision: true, pdf: true, tools: true, nativeWebSearch: true },
    contextWindow: 1_000_000,
  },
  // P1 で Claude on Vertex を追加する
];

export const MOCK_MODEL: ModelSpec = {
  id: "mock",
  provider: "mock",
  modelId: "mock",
  label: "Mock (開発用)",
  description: "GCP なしで動作確認するためのダミー応答",
  capabilities: { vision: false, pdf: false, tools: false, nativeWebSearch: false },
  contextWindow: 100_000,
};

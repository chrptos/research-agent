import "server-only";
import { createVertex } from "@ai-sdk/google-vertex";
import type { LanguageModel } from "ai";
import { env } from "@/env";
import { MOCK_MODEL, MODELS, type ModelSpec } from "./models";
import { createMockModel } from "./mock";

/** 現在の設定で使えるモデル。LLM_MOCK=true ならモックだけ */
export function availableModels(): ModelSpec[] {
  return env.LLM_MOCK ? [MOCK_MODEL] : MODELS;
}

export function defaultModel(): ModelSpec {
  return availableModels()[0];
}

export function findModel(id: string | undefined): ModelSpec {
  return availableModels().find((m) => m.id === id) ?? defaultModel();
}

let vertex: ReturnType<typeof createVertex> | undefined;

export function getLanguageModel(spec: ModelSpec): LanguageModel {
  switch (spec.provider) {
    case "mock":
      return createMockModel();
    case "vertex":
      // 認証は Application Default Credentials（Cloud Run ではサービスアカウント）を使う
      vertex ??= createVertex({
        project: env.GOOGLE_VERTEX_PROJECT,
        location: env.GOOGLE_VERTEX_LOCATION,
      });
      return vertex(spec.modelId);
    case "vertex-anthropic":
      throw new Error("Claude on Vertex は P1 で対応予定です");
  }
}

/** タイトル生成など補助的な処理に使う安いモデル */
export function utilityModel(): LanguageModel {
  return getLanguageModel(env.LLM_MOCK ? MOCK_MODEL : MODELS[0]);
}

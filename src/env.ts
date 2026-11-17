import { z } from "zod";

const bool = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => v === "true");

const schema = z.object({
  DATABASE_URL: z.string().url(),
  // Vertex AI
  GOOGLE_VERTEX_PROJECT: z.string().optional(),
  GOOGLE_VERTEX_LOCATION: z.string().default("global"),
  // LLM をモックに差し替える（GCP 認証なしでローカル開発・E2E テストをするため）
  LLM_MOCK: bool,
  // 認証
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_DEV_LOGIN: bool,
  ALLOWED_EMAIL_DOMAINS: z.string().default(""),
  ALLOWED_EMAILS: z.string().default(""),
});

export const env = schema.parse(process.env);

export const allowedDomains = env.ALLOWED_EMAIL_DOMAINS.split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
export const allowedEmails = env.ALLOWED_EMAILS.split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

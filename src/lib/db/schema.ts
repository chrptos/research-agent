import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";
import type { UIMessage } from "ai";

export const userRole = pgEnum("user_role", ["admin", "member"]);
export const messageRole = pgEnum("message_role", ["user", "assistant", "system"]);
export const messageStatus = pgEnum("message_status", ["done", "aborted", "error"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  role: userRole("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conversations = pgTable(
  "conversations",
  {
    // クライアント (useChat) が生成した ID をそのまま使う
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title"),
    modelId: text("model_id").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversations_user_updated_idx").on(t.userId, t.updatedAt.desc())],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    // 将来の分岐（編集・再生成）用。P0 では未使用
    parentId: text("parent_id"),
    role: messageRole("role").notNull(),
    // AI SDK の UIMessage["parts"] をそのまま保存する
    parts: jsonb("parts").$type<UIMessage["parts"]>().notNull(),
    modelId: text("model_id"),
    status: messageStatus("status").notNull().default("done"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    // 同一会話内での並び順
    seq: integer("seq").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index("messages_conversation_seq_idx").on(t.conversationId, t.seq)],
);

export type User = typeof users.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;

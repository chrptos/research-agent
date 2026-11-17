import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { UIMessage } from "ai";
import { db } from "./client";
import { conversations, messages, users } from "./schema";

export async function upsertUser(input: { email: string; name?: string | null; image?: string | null }) {
  const [row] = await db
    .insert(users)
    .values({ email: input.email.toLowerCase(), name: input.name, image: input.image })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: input.name, image: input.image },
    })
    .returning();
  return row;
}

export async function listConversations(userId: string) {
  return db
    .select({ id: conversations.id, title: conversations.title, updatedAt: conversations.updatedAt })
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.archived, false)))
    .orderBy(desc(conversations.updatedAt))
    .limit(100);
}

/** 所有者が一致する場合だけ会話を返す */
export async function getConversation(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  return row ?? null;
}

/** 会話がなければ作成する。他人の会話 ID なら null を返す */
export async function getOrCreateConversation(id: string, userId: string, modelId: string) {
  await db.insert(conversations).values({ id, userId, modelId }).onConflictDoNothing();
  const conv = await getConversation(id, userId);
  if (conv && conv.modelId !== modelId) {
    await db.update(conversations).set({ modelId }).where(eq(conversations.id, id));
    conv.modelId = modelId;
  }
  return conv;
}

export async function loadMessages(conversationId: string): Promise<UIMessage[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.seq));
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    parts: r.parts,
    metadata: { modelId: r.modelId ?? undefined, status: r.status },
  }));
}

export async function saveMessage(input: {
  conversationId: string;
  message: UIMessage;
  modelId?: string;
  status?: "done" | "aborted" | "error";
  inputTokens?: number;
  outputTokens?: number;
}) {
  const { conversationId, message } = input;
  await db.transaction(async (tx) => {
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${messages.seq}), 0) + 1` })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    await tx
      .insert(messages)
      .values({
        id: message.id,
        conversationId,
        role: message.role,
        parts: message.parts,
        modelId: input.modelId,
        status: input.status ?? "done",
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        seq: Number(next),
      })
      .onConflictDoUpdate({
        target: messages.id,
        set: { parts: message.parts, status: input.status ?? "done" },
      });
    await tx
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  });
}

export async function setConversationTitle(id: string, title: string) {
  await db.update(conversations).set({ title }).where(eq(conversations.id, id));
}

export async function deleteConversation(id: string, userId: string) {
  const res = await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning({ id: conversations.id });
  return res.length > 0;
}

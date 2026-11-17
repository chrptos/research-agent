import {
  consumeStream,
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  validateUIMessages,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { currentUserId } from "@/lib/auth";
import { getOrCreateConversation, loadMessages, saveMessage, setConversationTitle } from "@/lib/db/queries";
import { systemInstructions } from "@/lib/llm/prompts";
import { findModel, getLanguageModel } from "@/lib/llm/registry";
import { generateTitle } from "@/lib/llm/title";

// Cloud Run で長い応答をストリーミングできるよう、上限を延ばしておく
export const maxDuration = 300;

const bodySchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  message: z.object({ id: z.string(), role: z.literal("user"), parts: z.array(z.any()) }).passthrough(),
  modelId: z.string().optional(),
});

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Bad Request", { status: 400 });
  const { id, modelId } = parsed.data;

  const model = findModel(modelId);
  const conversation = await getOrCreateConversation(id, userId, model.id);
  if (!conversation) return new Response("Not Found", { status: 404 });

  const previous = await loadMessages(id);
  const [userMessage] = await validateUIMessages({ messages: [parsed.data.message as UIMessage] });
  // 送信直後に保存しておく（応答が失敗してもユーザーの入力は残る）
  await saveMessage({ conversationId: id, message: userMessage });
  const messages = [...previous.filter((m) => m.id !== userMessage.id), userMessage];

  const result = streamText({
    model: getLanguageModel(model),
    instructions: systemInstructions(),
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
      messageMetadata: ({ part }) => (part.type === "start" ? { modelId: model.id } : undefined),
      onEnd: async ({ responseMessage, isAborted, isCancelled }) => {
        if (responseMessage.parts.length === 0) return;
        const usage = await Promise.resolve(result.totalUsage).catch(() => undefined);
        await saveMessage({
          conversationId: id,
          message: responseMessage,
          modelId: model.id,
          status: isAborted || isCancelled ? "aborted" : "done",
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
        });
        if (!conversation.title) {
          const title = await generateTitle(userMessage, responseMessage).catch(() => null);
          if (title) await setConversationTitle(id, title);
        }
      },
      onError: (error) => {
        console.error("chat stream error", error);
        return "応答の生成中にエラーが発生しました。";
      },
    }),
    consumeSseStream: consumeStream,
  });
}

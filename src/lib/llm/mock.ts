import "server-only";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

function lastUserText(prompt: unknown): string {
  const msgs = prompt as { role: string; content: unknown }[];
  const last = [...msgs].reverse().find((m) => m.role === "user");
  if (!last || !Array.isArray(last.content)) return "";
  return last.content
    .filter((p: { type: string }) => p.type === "text")
    .map((p: { text: string }) => p.text)
    .join(" ");
}

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

/** 入力をオウム返しするモック。ストリーミングの見た目を確認できるよう少しずつ返す */
export function createMockModel() {
  return new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => ({
      content: [{ type: "text", text: (lastUserText(prompt).match(/ユーザー: (.*)/)?.[1] ?? "モック").slice(0, 20) }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
    doStream: async ({ prompt }) => {
      const reply = `これはモックの応答です。\n\nあなたの入力: **${lastUserText(prompt)}**\n\n\`\`\`ts\nconsole.log("hello");\n\`\`\``;
      const words = reply.match(/.{1,4}/gs) ?? [];
      return {
        stream: simulateReadableStream({
          initialDelayInMs: 100,
          chunkDelayInMs: 30,
          chunks: [
            { type: "stream-start", warnings: [] },
            { type: "text-start", id: "t1" },
            ...words.map((w) => ({ type: "text-delta" as const, id: "t1", delta: w })),
            { type: "text-end", id: "t1" },
            { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
          ],
        }),
      };
    },
  });
}

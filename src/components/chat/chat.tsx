"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ModelSpec } from "@/lib/llm/models";
import { Composer } from "./composer";
import { MessageView } from "./message";

type Props = {
  id: string;
  initialMessages: UIMessage[];
  models: ModelSpec[];
  initialModelId: string;
  isNew?: boolean;
};

export function Chat({ id, initialMessages, models, initialModelId, isNew }: Props) {
  const router = useRouter();
  const [modelId, setModelId] = useState(initialModelId);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        // 履歴はサーバーが DB から読むので、最後のメッセージだけ送る
        prepareSendMessagesRequest: ({ messages, id, body }) => ({
          body: { ...body, id, message: messages[messages.length - 1] },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    id,
    messages: initialMessages,
    transport,
    onFinish: () => {
      // 新規チャットなら URL を会話ページに切り替え、サイドバーを更新する
      if (isNew && window.location.pathname === "/") {
        window.history.replaceState(null, "", `/c/${id}`);
      }
      router.refresh();
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2">
        <label className="sr-only" htmlFor="model">
          モデル
        </label>
        <select
          id="model"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          className="rounded-md bg-transparent px-2 py-1 text-sm font-medium hover:bg-bubble"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </header>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4">
            <h1 className="text-2xl font-semibold">何かお手伝いできることはありますか？</h1>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
            {messages.map((m) => (
              <MessageView key={m.id} message={m} />
            ))}
            {status === "submitted" && <div className="animate-pulse text-muted">●</div>}
            {error && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                エラーが発生しました。{" "}
                <button className="underline" onClick={() => regenerate({ body: { modelId } })}>
                  再試行
                </button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <Composer busy={busy} onSend={(text) => sendMessage({ text }, { body: { modelId } })} onStop={stop} />
    </div>
  );
}

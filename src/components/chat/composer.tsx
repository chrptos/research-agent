"use client";

import { useRef, useState } from "react";

type Props = { busy: boolean; onSend: (text: string) => void; onStop: () => void };

export function Composer({ busy, onSend, onStop }: Props) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const t = text.trim();
    if (!t || busy) return;
    onSend(t);
    setText("");
    if (ref.current) ref.current.style.height = "auto";
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      <div className="flex items-end gap-2 rounded-2xl border border-border bg-bubble p-2">
        <textarea
          ref={ref}
          value={text}
          rows={1}
          placeholder="メッセージを入力（Shift+Enter で改行）"
          aria-label="メッセージ"
          className="max-h-60 flex-1 resize-none bg-transparent px-2 py-1.5 outline-none"
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            // 日本語入力の変換確定の Enter では送信しない
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {busy ? (
          <button
            onClick={onStop}
            className="h-9 w-9 shrink-0 rounded-full bg-foreground text-background"
            aria-label="生成を停止"
          >
            ■
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!text.trim()}
            className="h-9 w-9 shrink-0 rounded-full bg-foreground text-background disabled:opacity-30"
            aria-label="送信"
          >
            ↑
          </button>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-muted">AI の回答は間違っていることがあります。</p>
    </div>
  );
}

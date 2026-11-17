"use client";

import type { UIMessage } from "ai";
import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function CodeBlock({ children }: { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative">
      <pre>{children}</pre>
      <button
        className="absolute top-2 right-2 rounded bg-background/80 px-2 py-0.5 text-xs opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          const pre = e.currentTarget.previousElementSibling as HTMLElement;
          navigator.clipboard.writeText(pre.innerText);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "コピーしました" : "コピー"}
      </button>
    </div>
  );
}

const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: CodeBlock,
          a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});

export function MessageView({ message }: { message: UIMessage }) {
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
  const aborted = (message.metadata as { status?: string } | undefined)?.status === "aborted";

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-3xl bg-bubble px-4 py-2.5">{text}</div>
      </div>
    );
  }

  return (
    <div>
      <Markdown text={text} />
      {aborted && <p className="mt-1 text-xs text-muted">（生成を停止しました）</p>}
    </div>
  );
}

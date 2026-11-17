"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Item = { id: string; title: string; updatedAt: string };

function groupLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000;
  if (diff <= 0) return "今日";
  if (diff <= 1) return "昨日";
  if (diff <= 7) return "過去7日間";
  return "それ以前";
}

export function ConversationList({ items }: { items: Item[] }) {
  const pathname = usePathname();
  const router = useRouter();

  async function remove(id: string) {
    if (!confirm("この会話を削除しますか？")) return;
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (pathname === `/c/${id}`) router.push("/");
    router.refresh();
  }

  if (items.length === 0) {
    return <p className="px-2 py-4 text-xs text-muted">まだ会話はありません</p>;
  }

  const groups = items.map((c) => groupLabel(c.updatedAt));
  return (
    <ul className="space-y-0.5">
      {items.map((c, i) => {
        const header = i === 0 || groups[i] !== groups[i - 1] ? groups[i] : null;
        const active = pathname === `/c/${c.id}`;
        return (
          <li key={c.id}>
            {header && <div className="px-2 pt-3 pb-1 text-xs font-medium text-muted">{header}</div>}
            <div
              className={`group flex items-center rounded-lg text-sm ${active ? "bg-bubble" : "hover:bg-bubble"}`}
            >
              <Link href={`/c/${c.id}`} className="min-w-0 flex-1 truncate px-2 py-2" title={c.title}>
                {c.title}
              </Link>
              <button
                onClick={() => remove(c.id)}
                className="mr-1 hidden rounded px-1.5 text-muted hover:text-red-500 group-hover:block"
                aria-label={`「${c.title}」を削除`}
              >
                ×
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

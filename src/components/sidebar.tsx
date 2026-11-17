import Link from "next/link";
import { signOut } from "@/lib/auth";
import { listConversations } from "@/lib/db/queries";
import { ConversationList } from "./conversation-list";

export async function Sidebar({ userId, userName }: { userId: string; userName: string }) {
  const conversations = await listConversations(userId);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
      <div className="p-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-bubble"
        >
          <span aria-hidden>＋</span> 新しいチャット
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-2" aria-label="会話履歴">
        <ConversationList
          items={conversations.map((c) => ({
            id: c.id,
            title: c.title ?? "新しいチャット",
            updatedAt: c.updatedAt.toISOString(),
          }))}
        />
      </nav>
      <div className="flex items-center justify-between gap-2 border-t border-border p-3 text-sm">
        <span className="truncate" title={userName}>
          {userName}
        </span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="shrink-0 rounded px-2 py-1 text-muted hover:bg-bubble">ログアウト</button>
        </form>
      </div>
    </aside>
  );
}

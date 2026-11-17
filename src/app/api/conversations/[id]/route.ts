import { currentUserId } from "@/lib/auth";
import { deleteConversation } from "@/lib/db/queries";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  const userId = await currentUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const ok = await deleteConversation(id, userId);
  return new Response(null, { status: ok ? 204 : 404 });
}

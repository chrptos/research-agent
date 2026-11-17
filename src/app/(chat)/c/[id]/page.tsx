import { notFound } from "next/navigation";
import { Chat } from "@/components/chat/chat";
import { currentUserId } from "@/lib/auth";
import { getConversation, loadMessages } from "@/lib/db/queries";
import { availableModels, findModel } from "@/lib/llm/registry";

export default async function ConversationPage({ params }: PageProps<"/c/[id]">) {
  const { id } = await params;
  const userId = await currentUserId();
  const conversation = userId ? await getConversation(id, userId) : null;
  if (!conversation) notFound();

  const messages = await loadMessages(id);
  return (
    <Chat
      key={id}
      id={id}
      initialMessages={messages}
      models={availableModels()}
      initialModelId={findModel(conversation.modelId).id}
    />
  );
}

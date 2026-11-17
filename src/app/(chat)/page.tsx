import { generateId } from "ai";
import { Chat } from "@/components/chat/chat";
import { availableModels, defaultModel } from "@/lib/llm/registry";

export default function NewChatPage() {
  const id = generateId();
  return (
    <Chat
      key={id}
      id={id}
      initialMessages={[]}
      models={availableModels()}
      initialModelId={defaultModel().id}
      isNew
    />
  );
}

import "server-only";
import { generateText, type UIMessage } from "ai";
import { utilityModel } from "./registry";

function textOf(m: UIMessage) {
  return m.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

/** 最初のやり取りから会話タイトルを作る */
export async function generateTitle(user: UIMessage, assistant?: UIMessage) {
  const { text } = await generateText({
    model: utilityModel(),
    instructions:
      "次の会話に、20文字以内の短いタイトルを付けてください。タイトルだけを出力し、記号や引用符は付けないでください。",
    prompt: `ユーザー: ${textOf(user).slice(0, 1000)}\nアシスタント: ${assistant ? textOf(assistant).slice(0, 500) : ""}`,
  });
  return text.trim().replace(/^["「]|["」]$/g, "").slice(0, 40) || "新しいチャット";
}

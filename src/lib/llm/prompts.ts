export function systemInstructions() {
  const today = new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  return [
    "あなたは親切で正確なアシスタントです。",
    `今日の日付は ${today} です。`,
    "ユーザーと同じ言語で、Markdown を使って簡潔に答えてください。",
    "分からないことは推測で断定せず、分からないと伝えてください。",
  ].join("\n");
}

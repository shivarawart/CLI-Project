
export function clip(text: string, maxLength = 4000): string {
  if (!text) return "";

  return text.length <= maxLength
    ? text
    : `${text.slice(0, maxLength)}\n\n...[truncated]`;
}


export async function replyMarkdown(
  ctx: {
    reply: (
      text: string,
      options?: Record<string, unknown>
    ) => Promise<unknown>;
  },
  text: string
): Promise<unknown> {
  return ctx.reply(clip(text), {
    parse_mode: "Markdown",
  });
}


export function commandArg(
  fullText: string,
  commandName: string
): string {
  const regex = new RegExp(`^\\/${commandName}(?:@\\w+)?\\s*`, "i");

  return fullText.replace(regex, "").trim();
}
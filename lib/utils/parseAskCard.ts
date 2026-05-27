interface AskCardData {
  questions: { question: string; options: string[] }[];
}

const ASK_TAG_RE = /<ask_user>([\s\S]*?)<\/ask_user>/;

export function parseAskCard(content: string): AskCardData | null {
  const match = content.match(ASK_TAG_RE);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1].trim());
    if (
      !Array.isArray(data.questions) ||
      data.questions.some(
        (q: unknown) =>
          !q ||
          typeof (q as Record<string, unknown>).question !== "string" ||
          !Array.isArray((q as Record<string, unknown>).options),
      )
    ) {
      return null;
    }
    return data as AskCardData;
  } catch {
    return null;
  }
}

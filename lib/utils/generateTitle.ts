/**
 * Calls /api/chat with a lightweight summarisation prompt and returns the
 * generated title.  Reuses the existing provider infrastructure — no new
 * API route needed.
 */
export async function generateTitle(
  providerId: string,
  firstUserMessage: string,
): Promise<string> {
  const prompt = `Generate a short, descriptive title (6 words max) for a conversation that starts with:\n\n"${firstUserMessage.slice(0, 300)}"\n\nReturn ONLY the title — no quotes, no punctuation, no explanation.`;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        providerId,
        temperature: 0.3,
        maxTokens: 50,
      }),
    });

    if (!res.ok) throw new Error(`API ${res.status}`);

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No body");

    const decoder = new TextDecoder();
    const chunks: string[] = [];
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) chunks.push(delta);
        } catch {
          /* skip unparseable */
        }
      }
    }

    // Drain decoder + remaining buffer
    buffer += decoder.decode();
    for (const line of buffer.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) chunks.push(delta);
      } catch {
        /* skip */
      }
    }

    const raw = chunks.join("").trim();
    // Remove common artefacts: leading/trailing quotes, trailing dots, "Title:" prefix
    const cleaned = raw
      .replace(/^["']|["']$/g, "")
      .replace(/\.+$/, "")
      .replace(/^Title:\s*/i, "")
      .trim();

    return cleaned.slice(0, 80) || "New conversation";
  } catch {
    return "New conversation";
  }
}

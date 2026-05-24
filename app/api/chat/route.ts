import { type NextRequest } from "next/server";
import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { getProvider } from "@/lib/providers";
import { getDefaultModel } from "@/lib/providers/registry";
import { SYSTEM_PROMPT_ARTIFACT } from "@/lib/defaults";
import type { Message } from "@/types/conversation";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) {
    return Response.json(
      { error: 'Request body must include "messages" array' },
      { status: 400 },
    );
  }

  const {
    messages,
    providerId = getDefaultModel(),
    temperature,
    maxTokens,
    systemPrompt,
  } = body as {
    messages: Message[];
    providerId?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  };

  const basePrompt = SYSTEM_PROMPT_ARTIFACT;
  const mergedSystemPrompt = systemPrompt
    ? `${basePrompt}\n\n${systemPrompt}`
    : basePrompt;

  const provider = getProvider(providerId);

  const rawStream = await provider.stream(messages, {
    temperature,
    maxTokens,
    systemPrompt: mergedSystemPrompt,
  });

  // Tee the stream: one copy to the client, one for server-side logging
  const [clientStream, logStream] = rawStream.tee();

  // Accumulate and append to file in background — never blocks the response
  const now = new Date();
  const model = providerId;
  const tz8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const timestamp = tz8.toISOString().replace("Z", "+08:00");
  const divider = "─".repeat(72);

  const header = [
    "",
    divider,
    `  Model   │ ${model}`,
    `  Time    │ ${timestamp}`,
    `  Prompt  │ unified artifact`,
    `  Tokens  │ ~${maxTokens ?? "default"}`,
    divider,
    "",
  ].join("\n");

  const decoder = new TextDecoder();
  let logContent = "";
  const reader = logStream.getReader();
  function pump(): Promise<void> {
    return reader.read().then(({ done, value }) => {
      if (done) {
        const filePath = join(process.cwd(), "modelresponse");
        const entry = header + logContent + "\n";
        return appendFile(filePath, entry, "utf-8").catch(() => {});
      }
      logContent += decoder.decode(value, { stream: true });
      return pump();
    });
  }
  pump();

  return new Response(clientStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

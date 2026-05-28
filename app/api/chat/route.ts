import { type NextRequest } from "next/server";
// import { appendFile, readFile, writeFile } from "node:fs/promises";
// import { join } from "node:path";
import { getProvider } from "@/lib/providers";
import { getDefaultModel } from "@/lib/providers/registry";
import { SYSTEM_PROMPT_ARTIFACT } from "@/lib/defaults";
import { logger } from "@/lib/utils/logger";
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

  logger.info("[chat] request", {
    model: providerId,
    msgCount: messages.length,
    maxTokens,
  });

  const rawStream = await provider.stream(messages, {
    temperature,
    maxTokens,
    systemPrompt: mergedSystemPrompt,
  });

  // --- File logging to modelresponse (comment out to disable) ---
  // const now = new Date();
  // const model = providerId;
  // const tz8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  // const timestamp = tz8.toISOString().replace("Z", "+08:00");
  // const divider = "─".repeat(72);
  //
  // const header = [
  //   "",
  //   divider,
  //   `  Model   │ ${model}`,
  //   `  Time    │ ${timestamp}`,
  //   `  Prompt  │ unified artifact`,
  //   `  Tokens  │ ~${maxTokens ?? "default"}`,
  //   divider,
  //   "",
  // ].join("\n");

  // Pass-through stream: relays chunks from provider to client.
  const reader = rawStream.getReader();
  // const decoder = new TextDecoder();
  // let logContent = "";

  const passThrough = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        // --- File logging (uncomment to re-enable) ---
        // const filePath = join(process.cwd(), "modelresponse");
        // const entry = header + logContent + "\n";
        // readFile(filePath, "utf-8")
        //   .then((old) => {
        //     const lines = old.split(divider + "\n");
        //     const keep = lines.slice(-50);
        //     return writeFile(filePath, keep.join(divider + "\n") + entry, "utf-8");
        //   })
        //   .catch(() => appendFile(filePath, entry, "utf-8"));

        logger.info("[chat] stream ended", { model: providerId });
        controller.close();
        return;
      }
      // logContent += decoder.decode(value, { stream: true });
      controller.enqueue(value);
    },
  });

  return new Response(passThrough, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

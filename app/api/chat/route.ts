import { type NextRequest } from "next/server";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getProvider } from "@/lib/providers";
import { getDefaultModel } from "@/lib/providers/registry";
import { SYSTEM_PROMPT_ARTIFACT } from "@/lib/defaults";
import type { Message } from "@/types/conversation";

export const maxDuration = 60;

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
    temperature = Number(process.env.NEXT_PUBLIC_DEFAULT_TEMPERATURE || 1),
    maxTokens = Number(process.env.NEXT_PUBLIC_DEFAULT_MAX_TOKENS || 8192),
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
  const reqId = (body as { conversationId?: string }).conversationId?.slice(-8) ?? "-";
  const startedAt = Date.now();

  console.log("┌─ chat  %s ──────────────────────────", reqId);
  console.log("│  model   %s", providerId);
  console.log("│  msgs    %d", messages.length);
  console.log("│  tokens  %d", maxTokens ?? 0);

  const rawStream = await provider.stream(messages, {
    temperature,
    maxTokens,
    systemPrompt: mergedSystemPrompt,
  });

  // Debug-mode file logging — gated behind NEXT_PUBLIC_DEBUG
  const debug = process.env.NEXT_PUBLIC_DEBUG === "true";
  const now = debug ? new Date() : new Date(0);
  const model = providerId;
  const tz8 = debug ? new Date(now.getTime() + 8 * 60 * 60 * 1000) : new Date(0);
  const timestamp = debug ? tz8.toISOString().replace("Z", "+08:00") : "";
  const divider = "─".repeat(72);

  const header = debug
    ? [
        "",
        divider,
        `  Model   │ ${model}`,
        `  Time    │ ${timestamp}`,
        `  Prompt  │ unified artifact`,
        `  Tokens  │ ~${maxTokens ?? "default"}`,
        divider,
        "",
      ].join("\n")
    : "";

  const reader = rawStream.getReader();
  const decoder = debug ? new TextDecoder() : null;
  let logContent = "";

  const passThrough = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        if (debug) {
          const filePath = join(process.cwd(), "modelresponse.log");
          const entry = header + logContent + "\n";
          readFile(filePath, "utf-8")
            .then((old) => {
              const lines = old.split(divider + "\n");
              const keep = lines.slice(-50);
              return writeFile(filePath, keep.join(divider + "\n") + entry, "utf-8");
            })
            .catch(() => appendFile(filePath, entry, "utf-8"));
        }

        console.log("│  done    %dms", Date.now() - startedAt);
        console.log("└────────────────────────────────────");
        controller.close();
        return;
      }
      if (debug && decoder) logContent += decoder.decode(value, { stream: true });
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

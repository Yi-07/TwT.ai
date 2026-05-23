import { type NextRequest } from "next/server";
import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { getProvider } from "@/lib/providers";
import { getDefaultModel } from "@/lib/providers/registry";
import { SYSTEM_PROMPT_TEXT, SYSTEM_PROMPT_ARTIFACT } from "@/lib/defaults";
import type { Message } from "@/types/conversation";

function classifyIntent(messages: Message[]): "artifact" | "text" {
  const last = messages.at(-1);
  if (!last || last.role !== "user") return "text";
  const content = last.content.toLowerCase();
  const artifactTriggers = [
    "做一个", "帮我做", "生成一个", "创建一个", "画一个", "写一个组件",
    "帮我画", "做个", "生成个", "写个", "可视化", "图表", "dashboard",
    "make a", "create a", "build a", "generate a", "draw a", "visualize",
    "component", "chart", "graph", "interactive",
  ];
  return artifactTriggers.some((kw) => content.includes(kw)) ? "artifact" : "text";
}

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

  const intent = classifyIntent(messages);
  const basePrompt = intent === "artifact" ? SYSTEM_PROMPT_ARTIFACT : SYSTEM_PROMPT_TEXT;
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
  const timestamp = now.toISOString();
  const divider = "─".repeat(72);

  const header = [
    "",
    divider,
    `  Model   │ ${model}`,
    `  Time    │ ${timestamp}`,
    `  Intent  │ ${intent}`,
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

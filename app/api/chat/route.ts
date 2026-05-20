import { type NextRequest } from "next/server";
import { getProvider } from "@/lib/providers";
import { getDefaultModel } from "@/lib/providers/registry";
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

  const provider = getProvider(providerId);

  const stream = await provider.stream(messages, {
    temperature,
    maxTokens,
    systemPrompt,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

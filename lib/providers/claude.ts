import type { Message } from "@/types/conversation";
import type { ModelOptions } from "@/types/provider";
import { BaseProvider } from "./base";
import Anthropic from "@anthropic-ai/sdk";

export class ClaudeProvider extends BaseProvider {
  id = "claude";
  name = "Claude";
  protected defaultModel = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
  protected apiKey: string;
  protected baseUrl = "https://api.anthropic.com";

  private client: Anthropic;

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.client = new Anthropic({ apiKey: this.apiKey });
  }

  async stream(
    messages: Message[],
    options: ModelOptions = {},
  ): Promise<ReadableStream> {
    this.setupAbort();

    const systemMessage = options.systemPrompt
      ? [{ type: "text" as const, text: options.systemPrompt }]
      : undefined;

    const stream = this.client.messages.stream(
      {
        model: this.defaultModel,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature,
        system: systemMessage,
        messages: messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      },
      {
        signal: this.getSignal(),
      },
    );

    return new ReadableStream({
      start: (controller) => {
        stream.on("text", (text) => {
          const chunk = JSON.stringify({
            choices: [{ delta: { content: text } }],
          });
          controller.enqueue(new TextEncoder().encode(`data: ${chunk}\n\n`));
        });

        stream.on("end", () => {
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        });

        stream.on("error", (error) => {
          controller.error(error);
        });

        stream.on("abort", () => {
          controller.close();
        });
      },
      cancel: () => {
        stream.abort();
      },
    });
  }
}

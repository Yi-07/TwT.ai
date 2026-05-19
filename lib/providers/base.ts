import type { Message } from "@/types/conversation";
import type { ModelProvider, ModelOptions } from "@/types/provider";

export abstract class BaseProvider implements ModelProvider {
  abstract id: string;
  abstract name: string;
  protected abstract defaultModel: string;
  protected abstract apiKey: string;
  protected abstract baseUrl: string;

  private controller: AbortController | null = null;

  abort(): void {
    this.controller?.abort();
    this.controller = null;
  }

  async stream(
    messages: Message[],
    options: ModelOptions = {},
  ): Promise<ReadableStream> {
    this.controller = new AbortController();

    const body = this.buildRequestBody(messages, options);
    const headers = this.buildHeaders();

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: this.controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `${this.name} API error ${response.status}: ${errorText}`,
      );
    }

    if (!response.body) {
      throw new Error(`${this.name} returned an empty response body`);
    }

    return response.body;
  }

  protected buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  protected buildRequestBody(
    messages: Message[],
    options: ModelOptions,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.defaultModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    };

    if (options.temperature != null) body.temperature = options.temperature;
    if (options.maxTokens != null) body.max_tokens = options.maxTokens;
    if (options.systemPrompt) {
      body.messages = [
        { role: "system", content: options.systemPrompt },
        ...(body.messages as Array<Record<string, string>>),
      ];
    }

    return body;
  }
}

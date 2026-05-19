import type { Message } from "./conversation";

export interface ModelProvider {
  id: string;
  name: string;
  stream(messages: Message[], options: ModelOptions): Promise<ReadableStream>;
  abort(): void;
}

export interface ModelOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

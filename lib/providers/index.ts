import type { ModelProvider } from "@/types/provider";
import { ClaudeProvider } from "./claude";
import { OpenAICompatibleProvider } from "./generic";
import {
  getProviderConfigs,
  getProviderMetas,
  type ProviderConfig,
} from "./config";

export { type ProviderConfig, getProviderMetas };

function createProvider(config: ProviderConfig): ModelProvider {
  switch (config.type) {
    case "anthropic":
      return new ClaudeProvider(config);
    case "openai-compatible":
      return new OpenAICompatibleProvider(config);
  }
}

export function getProvider(id: string): ModelProvider {
  const config = getProviderConfigs().find((c) => c.id === id);
  if (!config) {
    const available = getProviderConfigs()
      .map((c) => c.id)
      .join(", ");
    throw new Error(
      `Unknown provider: "${id}". Available: ${available}`,
    );
  }

  return createProvider(config);
}

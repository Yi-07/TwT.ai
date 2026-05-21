import type { ModelProvider } from "@/types/provider";
import { ClaudeProvider } from "./claude";
import { DeepSeekProvider } from "./deepseek";
import { ModelScopeProvider } from "./modelscope";
import { type ProviderMeta, getProviderMetas } from "./registry";

const providerConstructors: Record<
  string,
  new () => ModelProvider
> = {
  claude: ClaudeProvider,
  deepseek: DeepSeekProvider,
  modelscope: ModelScopeProvider,
};

export { type ProviderMeta, getProviderMetas };

const providerCache = new Map<string, ModelProvider>();

export function getProvider(id: string): ModelProvider {
  const cached = providerCache.get(id);
  if (cached) return cached;

  const Ctor = providerConstructors[id];
  if (!Ctor) {
    throw new Error(
      `Unknown provider: "${id}". Available: ${Object.keys(providerConstructors).join(", ")}`,
    );
  }

  const instance = new Ctor();
  providerCache.set(id, instance);
  return instance;
}

export function listProviders(): Array<{ id: string; name: string }> {
  return Object.keys(providerConstructors).map((id) => {
    const provider = getProvider(id);
    return { id: provider.id, name: provider.name };
  });
}

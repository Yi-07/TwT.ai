import type { ModelProvider } from "@/types/provider";
import { ClaudeProvider } from "./claude";
import { DeepSeekProvider } from "./deepseek";

const providerConstructors: Record<
  string,
  new () => ModelProvider
> = {
  claude: ClaudeProvider,
  deepseek: DeepSeekProvider,
};

interface ProviderMeta {
  id: string;
  name: string;
}

const providerMetaList: ProviderMeta[] = [
  { id: "claude", name: "Claude" },
  { id: "deepseek", name: "DeepSeek" },
];

export { type ProviderMeta };

export function getProviderMetas(): ProviderMeta[] {
  return providerMetaList;
}

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
  // Instantiate each provider type once to read its id/name,
  // then cache for future use.
  return Object.keys(providerConstructors).map((id) => {
    const provider = getProvider(id);
    return { id: provider.id, name: provider.name };
  });
}

export interface ProviderMeta {
  id: string;
  name: string;
}

const providerMetaList: ProviderMeta[] = [
  { id: "claude", name: "Claude" },
  { id: "deepseek", name: "DeepSeek" },
];

export function getProviderMetas(): ProviderMeta[] {
  return providerMetaList;
}

export function getDefaultModel(): string {
  return process.env.NEXT_PUBLIC_DEFAULT_PROVIDER || "deepseek";
}

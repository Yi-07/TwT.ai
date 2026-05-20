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

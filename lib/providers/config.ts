export interface ProviderConfig {
  id: string;
  name: string;
  type: "openai-compatible" | "anthropic";
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface ProviderMeta {
  id: string;
  name: string;
}

const BUILTIN_METAS: ProviderMeta[] = [
  { id: "claude", name: "Claude" },
  { id: "deepseek", name: "DeepSeek" },
  { id: "modelscope", name: "ModelScope" },
];

function parseJson(raw?: string): Record<string, unknown>[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Client-safe — only id + name, no API keys. */
export function getProviderMetas(): ProviderMeta[] {
  const custom = parseJson(
    process.env.NEXT_PUBLIC_CUSTOM_PROVIDERS,
  ) as unknown as ProviderMeta[];
  return [...BUILTIN_METAS, ...custom.map((c) => ({ id: c.id, name: c.name }))];
}

/** Server-only — full config with API keys. */
export function getProviderConfigs(): ProviderConfig[] {
  const builtIn: ProviderConfig[] = [
    {
      id: "claude",
      name: "Claude",
      type: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      baseUrl: process.env.CLAUDE_BASE_URL || "https://api.anthropic.com",
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
    },
    {
      id: "deepseek",
      name: "DeepSeek",
      type: "openai-compatible",
      apiKey: process.env.DEEPSEEK_API_KEY ?? "",
      baseUrl: "https://api.deepseek.com/v1",
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    },
    {
      id: "modelscope",
      name: "ModelScope",
      type: "openai-compatible",
      apiKey: process.env.DASHSCOPE_API_KEY ?? "",
      baseUrl: "https://api-inference.modelscope.cn/v1",
      model: process.env.MODELSCOPE_MODEL || "qwen-plus",
    },
  ];

  const userDefined = parseJson(
    process.env.CUSTOM_PROVIDERS,
  ) as unknown as ProviderConfig[];

  return [...builtIn, ...userDefined];
}

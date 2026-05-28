import type { ProviderConfig } from "./config";

export type ProviderMeta = Pick<ProviderConfig, "id" | "name">;

export { getProviderMetas } from "./config";

export function getDefaultModel(): string {
  return process.env.NEXT_PUBLIC_DEFAULT_PROVIDER || "deepseek";
}

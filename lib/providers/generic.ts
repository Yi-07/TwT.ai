import { BaseProvider } from "./base";
import type { ProviderConfig } from "./config";

export class OpenAICompatibleProvider extends BaseProvider {
  id: string;
  name: string;
  protected defaultModel: string;
  protected apiKey: string;
  protected baseUrl: string;

  constructor(config: ProviderConfig) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.defaultModel = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
  }
}

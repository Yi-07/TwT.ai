import { BaseProvider } from "./base";

export class DeepSeekProvider extends BaseProvider {
  id = "deepseek";
  name = "DeepSeek";
  protected defaultModel = "deepseek-chat";
  protected apiKey: string;
  protected baseUrl = "https://api.deepseek.com/v1";

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey ?? process.env.DEEPSEEK_API_KEY ?? "";
  }
}

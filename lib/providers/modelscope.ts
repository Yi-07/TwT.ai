import { BaseProvider } from "./base";

export class ModelScopeProvider extends BaseProvider {
  id = "modelscope";
  name = "ModelScope";
  protected defaultModel = process.env.MODELSCOPE_MODEL || "qwen-plus";
  protected apiKey: string;
  protected baseUrl = "https://api-inference.modelscope.cn/v1";

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey ?? process.env.DASHSCOPE_API_KEY ?? "";
  }
}

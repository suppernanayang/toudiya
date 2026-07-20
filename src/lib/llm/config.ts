import type { LlmProviderName } from "./types";

// API Key、模型、接口地址都从环境变量读取，业务代码不允许硬编码。
export interface ProviderEnvConfig {
  apiKey: string | undefined;
  model: string;
  baseUrl: string;
}

export function getProviderEnvConfig(provider: LlmProviderName): ProviderEnvConfig {
  if (provider === "deepseek") {
    return {
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      baseUrl: "https://api.deepseek.com/v1/chat/completions",
    };
  }

  return {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4.1",
    baseUrl: "https://api.openai.com/v1/chat/completions",
  };
}

export function isProviderConfigured(provider: LlmProviderName): boolean {
  const config = getProviderEnvConfig(provider);
  return Boolean(config.apiKey && config.apiKey.trim().length > 0);
}

export function getConfiguredProviders(): Record<LlmProviderName, boolean> {
  return {
    deepseek: isProviderConfigured("deepseek"),
    openai: isProviderConfigured("openai"),
  };
}

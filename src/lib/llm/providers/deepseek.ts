import { getProviderEnvConfig, isProviderConfigured } from "../config";
import {
  LlmChatOptions,
  LlmChatResult,
  LlmNotConfiguredError,
  LlmProviderError,
} from "../types";

const PROVIDER = "deepseek" as const;

// DeepSeek 的 Chat Completions 接口和 OpenAI 兼容，直接用 fetch 调用，
// 不引入额外的 SDK 依赖。
export async function callDeepSeekChat(options: LlmChatOptions): Promise<LlmChatResult> {
  if (!isProviderConfigured(PROVIDER)) {
    throw new LlmNotConfiguredError(PROVIDER);
  }

  const { apiKey, baseUrl } = getProviderEnvConfig(PROVIDER);

  let response: Response;
  try {
    response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.3,
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch (error) {
    throw new LlmProviderError(PROVIDER, "调用 DeepSeek 接口失败（网络错误）", error);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new LlmProviderError(
      PROVIDER,
      `DeepSeek 接口返回错误：HTTP ${response.status} ${body}`.slice(0, 500),
    );
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new LlmProviderError(PROVIDER, "DeepSeek 返回内容格式不符合预期");
  }

  return {
    provider: PROVIDER,
    model: options.model,
    content,
  };
}

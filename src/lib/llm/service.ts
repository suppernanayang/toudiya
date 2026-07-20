import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { callDeepSeekChat } from "./providers/deepseek";
import { callOpenAiChat } from "./providers/openai";
import { getProviderEnvConfig, isProviderConfigured } from "./config";
import {
  LlmChatResult,
  LlmEnvelope,
  LlmMessage,
  LlmProviderError,
  LlmProviderName,
  LlmTaskCallMeta,
  LlmTaskName,
} from "./types";

interface TaskModelMapEntry {
  provider?: LlmProviderName;
  model?: string;
}

type TaskModelMap = Partial<Record<LlmTaskName, TaskModelMapEntry>>;

async function callProvider(
  provider: LlmProviderName,
  model: string,
  messages: LlmMessage[],
  jsonMode: boolean,
): Promise<LlmChatResult> {
  if (provider === "deepseek") {
    return callDeepSeekChat({ model, messages, jsonMode });
  }
  return callOpenAiChat({ model, messages, jsonMode });
}

/**
 * 根据用户在 llm_settings 里的配置，解析某个任务应该用哪个供应商 + 模型。
 * 任务级配置优先，没配置就用默认供应商；用户设置永远优先于代码里的写死值。
 */
async function resolveProviderForTask(task: LlmTaskName): Promise<{
  primary: { provider: LlmProviderName; model: string };
  fallback: { provider: LlmProviderName; model: string } | null;
}> {
  const settings = await prisma.llmSetting.findUnique({
    where: { userId: DEFAULT_USER_ID },
  });

  const defaultProvider: LlmProviderName =
    (settings?.defaultProvider as LlmProviderName) || "deepseek";
  const defaultModel =
    settings?.defaultModel || getProviderEnvConfig(defaultProvider).model;

  const fallbackProviderRaw = settings?.fallbackProvider;
  const autoFallback = settings?.autoFallback ?? true;

  const taskModelMap = (settings?.taskModelMap as TaskModelMap | null) || {};
  const override = taskModelMap[task];

  const primaryProvider = override?.provider || defaultProvider;
  const primaryModel = override?.model || getProviderEnvConfig(primaryProvider).model || defaultModel;

  let fallback: { provider: LlmProviderName; model: string } | null = null;
  if (
    autoFallback &&
    fallbackProviderRaw &&
    fallbackProviderRaw !== "disabled" &&
    fallbackProviderRaw !== primaryProvider
  ) {
    const fallbackProvider = fallbackProviderRaw as LlmProviderName;
    fallback = {
      provider: fallbackProvider,
      model: settings?.fallbackModel || getProviderEnvConfig(fallbackProvider).model,
    };
  }

  return {
    primary: { provider: primaryProvider, model: primaryModel },
    fallback,
  };
}

/**
 * 统一的任务调用入口：业务代码只调用这个方法（或下面的 callLlmJson），
 * 不直接接触具体 Provider。会自动处理"配置缺失 / 调用失败时切换备用模型"。
 */
export async function callLlmForTask(
  task: LlmTaskName,
  messages: LlmMessage[],
  options: { jsonMode?: boolean } = {},
): Promise<{ result: LlmChatResult; meta: LlmTaskCallMeta }> {
  const { primary, fallback } = await resolveProviderForTask(task);
  const jsonMode = options.jsonMode ?? true;

  const primaryConfigured = isProviderConfigured(primary.provider);

  if (primaryConfigured) {
    try {
      const result = await callProvider(primary.provider, primary.model, messages, jsonMode);
      return { result, meta: { ...primary, usedFallback: false } };
    } catch (error) {
      if (!fallback) throw error;
      console.warn(
        `[llm] ${primary.provider} 调用失败，尝试自动切换到备用模型 ${fallback.provider}：`,
        error instanceof Error ? error.message : error,
      );
    }
  } else if (!fallback) {
    throw new LlmProviderError(
      primary.provider,
      `${primary.provider} 未配置 API Key，且没有可用的备用模型。`,
    );
  }

  if (fallback) {
    if (!isProviderConfigured(fallback.provider)) {
      throw new LlmProviderError(
        fallback.provider,
        `主模型 ${primary.provider} 不可用，备用模型 ${fallback.provider} 也未配置 API Key。`,
      );
    }
    const result = await callProvider(fallback.provider, fallback.model, messages, jsonMode);
    return { result, meta: { ...fallback, usedFallback: true } };
  }

  throw new LlmProviderError(primary.provider, `${primary.provider} 调用失败，且没有配置备用模型。`);
}

function extractJsonBlock(content: string): string {
  const trimmed = content.trim();
  // 有些模型即使开了 json_object 模式，仍可能在前后包一层 ```json ``` 代码块，做个兜底提取。
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fencedMatch ? fencedMatch[1] : trimmed;
}

/**
 * 用于所有"要求 AI 返回结构化 JSON"的任务。
 * 会校验返回内容里必须包含 result / risk_notes / pending_confirmations / source_references，
 * 缺一样都认为是"AI 输出不是合法结构"，抛出清晰错误，不静默吞掉、不脑补内容。
 */
export async function callLlmJson<T>(
  task: LlmTaskName,
  messages: LlmMessage[],
): Promise<{ envelope: LlmEnvelope<T>; meta: LlmTaskCallMeta }> {
  const { result, meta } = await callLlmForTask(task, messages, { jsonMode: true });

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonBlock(result.content));
  } catch (error) {
    throw new LlmProviderError(
      meta.provider,
      `${meta.provider} 返回的内容不是合法 JSON，无法解析。原始内容片段：${result.content.slice(0, 300)}`,
      error,
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("result" in parsed)
  ) {
    throw new LlmProviderError(
      meta.provider,
      "AI 输出缺少必需的 result 字段，不符合投递鸭要求的结构化格式。",
    );
  }

  const envelope = parsed as LlmEnvelope<T>;
  envelope.risk_notes = envelope.risk_notes ?? [];
  envelope.pending_confirmations = envelope.pending_confirmations ?? [];
  envelope.source_references = envelope.source_references ?? [];

  return { envelope, meta };
}

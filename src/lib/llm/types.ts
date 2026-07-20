// LLM Provider 抽象层的公共类型定义。
// 业务代码只应该依赖这个文件里的类型和 src/lib/llm/service.ts 里的方法，
// 不应该直接引用某个具体供应商（DeepSeek / OpenAI）的实现。

export type LlmProviderName = "deepseek" | "openai";

export type LlmTaskName =
  | "job_analysis"
  | "resume_customization"
  | "application_message"
  | "interview_preparation"
  | "fact_review"
  | "resume_experience_extraction";

export interface LlmMessage {
  role: "system" | "user";
  content: string;
}

export interface LlmChatOptions {
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  jsonMode?: boolean;
}

export interface LlmChatResult {
  provider: LlmProviderName;
  model: string;
  content: string;
}

export class LlmProviderError extends Error {
  provider: LlmProviderName;
  cause?: unknown;

  constructor(provider: LlmProviderName, message: string, cause?: unknown) {
    super(message);
    this.name = "LlmProviderError";
    this.provider = provider;
    this.cause = cause;
  }
}

export class LlmNotConfiguredError extends LlmProviderError {
  constructor(provider: LlmProviderName) {
    super(provider, `${provider} 未配置 API Key，请先在 .env.local 中填写。`);
    this.name = "LlmNotConfiguredError";
  }
}

/**
 * 所有结构化 AI 输出都必须遵守这个信封格式，
 * 对应 TECH_SPEC.md 第 9 节"AI 输出安全"的要求：
 * - result：本次任务的结构化结果
 * - riskNotes：事实风险提醒
 * - pendingConfirmations：需要用户补充确认的具体问题
 * - sourceReferences：result 里的内容分别来自用户输入的哪些部分
 */
export interface LlmEnvelope<T> {
  result: T;
  risk_notes: string[];
  pending_confirmations: string[];
  source_references: string[];
}

export interface LlmTaskCallMeta {
  provider: LlmProviderName;
  model: string;
  usedFallback: boolean;
}

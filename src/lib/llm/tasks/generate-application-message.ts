import { callLlmJson } from "../service";
import { SAFETY_SYSTEM_PROMPT, buildUserPrompt } from "../prompts";
import type { LlmEnvelope, LlmTaskCallMeta } from "../types";

export interface ApplicationMessageResult {
  message: string;
  emailSubject: string;
  emailBody: string;
}

export async function generateApplicationMessage(input: {
  company: string;
  title: string;
  jobSummary: string;
  resumeSummary: string;
}): Promise<{ envelope: LlmEnvelope<ApplicationMessageResult>; meta: LlmTaskCallMeta }> {
  const systemPrompt = `${SAFETY_SYSTEM_PROMPT}

任务：为用户生成一段投递话术（可用于平台打招呼或邮件正文），语气专业、简洁，不夸大。

"result" 字段必须是一个对象：
{
  "message": string,      // 简短投递话术，适合平台打招呼场景，150 字以内
  "emailSubject": string, // 如果是邮件投递可以用的标题
  "emailBody": string     // 更完整的邮件正文，包含称呼、简单自我介绍、匹配点、结尾
}`;

  const userPrompt = buildUserPrompt({
    公司: input.company,
    岗位: input.title,
    "岗位摘要": input.jobSummary,
    "候选人简历摘要": input.resumeSummary,
  });

  return callLlmJson<ApplicationMessageResult>("application_message", [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
}

import { callLlmJson } from "../service";
import { SAFETY_SYSTEM_PROMPT, buildUserPrompt } from "../prompts";
import type { LlmEnvelope, LlmTaskCallMeta } from "../types";

export interface JobAnalysisResult {
  roleType: string;
  summary: string;
  responsibilities: string[];
  hardRequirements: string[];
  niceToHave: string[];
  keywords: string[];
  experienceYears: string;
  educationRequirements: string;
  riskFlags: string[];
  interviewFocus: string[];
}

export async function analyzeJobDescription(input: {
  company: string;
  title: string;
  jdText: string;
}): Promise<{ envelope: LlmEnvelope<JobAnalysisResult>; meta: LlmTaskCallMeta }> {
  const systemPrompt = `${SAFETY_SYSTEM_PROMPT}

任务：对一个岗位的 JD 做结构化分析。

"result" 字段必须是一个对象：
{
  "roleType": string,               // 岗位类型归类，例如"产品运营"
  "summary": string,                // 岗位摘要，2-4 句话
  "responsibilities": string[],     // 核心职责
  "hardRequirements": string[],     // 硬性要求
  "niceToHave": string[],           // 加分项
  "keywords": string[],             // 技能/能力关键词，用于后续简历定制
  "experienceYears": string,        // 经验年限要求，没写就是空字符串
  "educationRequirements": string,  // 学历要求，没写就是空字符串
  "riskFlags": string[],            // 匹配风险点，例如"要求 3 年经验，用户是应届生"
  "interviewFocus": string[]        // 面试可能重点考察的方向
}

如果 JD 信息明显不足（比如只有岗位名没有正文），在 pending_confirmations 里提出需要用户补充哪些信息，result 里对应字段可以留空数组或空字符串，不要编造内容硬凑。`;

  const userPrompt = buildUserPrompt({
    公司: input.company || "(未填写)",
    岗位名称: input.title || "(未填写)",
    "JD 原文": input.jdText,
  });

  return callLlmJson<JobAnalysisResult>("job_analysis", [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
}

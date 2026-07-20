import { callLlmJson } from "../service";
import { SAFETY_SYSTEM_PROMPT, buildUserPrompt } from "../prompts";
import type { LlmEnvelope, LlmTaskCallMeta } from "../types";

export type ExperienceType =
  | "education"
  | "internship"
  | "project"
  | "campus"
  | "work"
  | "certificate"
  | "award"
  | "portfolio";

export type EvidenceStatus = "confirmed" | "needs_confirmation" | "incomplete";

export interface ExtractedExperienceItem {
  experienceType: ExperienceType;
  title: string;
  organization?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  summary: string;
  tags: string[];
  skills: string[];
  evidenceStatus: EvidenceStatus;
}

export type ExtractResumeExperienceResult = ExtractedExperienceItem[];

export async function extractResumeExperience(resumeText: string): Promise<{
  envelope: LlmEnvelope<ExtractResumeExperienceResult>;
  meta: LlmTaskCallMeta;
}> {
  const systemPrompt = `${SAFETY_SYSTEM_PROMPT}

任务：从用户粘贴或上传解析出的简历文本中，提取出经历条目列表，作为"经历库"的初始内容。

"result" 字段必须是一个数组，每一项包含：
{
  "experienceType": "education" | "internship" | "project" | "campus" | "work" | "certificate" | "award" | "portfolio",
  "title": string,           // 经历标题，例如"内容社区运营项目"
  "organization": string,    // 学校/公司/组织，没有就留空字符串
  "role": string,            // 担任角色/职位，没有就留空字符串
  "startDate": string,       // 形如 2024-07，无法确定就留空字符串
  "endDate": string,         // 形如 2024-09 或"至今"，无法确定就留空字符串
  "summary": string,         // 对这段经历的简要概述，只能基于原文，不能编造
  "tags": string[],          // 方向标签，例如"产品运营"、"内容"
  "skills": string[],        // 涉及的技能关键词
  "evidenceStatus": "confirmed" | "needs_confirmation" | "incomplete"
}

evidenceStatus 判断标准：
- 原文信息完整（时间、机构、职责都清楚）-> "confirmed"
- 原文提到了但缺少关键信息（比如没写时间或没写成果）-> "needs_confirmation"
- 只有很模糊的一两句话，缺很多信息 -> "incomplete"`;

  const userPrompt = buildUserPrompt({
    简历原文: resumeText,
  });

  return callLlmJson<ExtractResumeExperienceResult>("resume_experience_extraction", [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
}

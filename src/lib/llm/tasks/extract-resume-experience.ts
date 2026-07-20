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
  | "portfolio"
  | "skill";

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
  "experienceType": "education" | "internship" | "project" | "campus" | "work" | "certificate" | "award" | "portfolio" | "skill",
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

关于 "skill" 类型的特别说明：
简历里经常会有一段没有时间线、没有具体机构的"技能"陈述（比如"熟练使用 Excel、PPT"、"熟悉 STP、4P、SWOT 等商业模型"、"会用 Codex、Claude Code 等 AI 编程工具"）。这类内容也要提取出来，不能因为没有时间/机构就跳过。
- 按主题分组打包成几条 "skill" 类型的条目，不要一个技能词拆成一条（比如"办公软件"分一条，"AI 工具"分一条，"商业分析模型"分一条），标题写这个技能主题的名字。
- "organization"、"role"、"startDate"、"endDate" 都留空字符串。
- "skills" 字段里放这一组具体的技能关键词列表。
- "summary" 可以留空字符串或者简单描述这组技能的使用场景。

evidenceStatus 判断标准：
- 原文信息完整（时间、机构、职责都清楚）-> "confirmed"
- 原文提到了但缺少关键信息（比如没写时间或没写成果）-> "needs_confirmation"
- 只有很模糊的一两句话，缺很多信息 -> "incomplete"
- "skill" 类型条目本来就没有时间/机构，只要技能关键词是原文真实出现过的，就标 "confirmed"`;

  const userPrompt = buildUserPrompt({
    简历原文: resumeText,
  });

  return callLlmJson<ExtractResumeExperienceResult>("resume_experience_extraction", [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
}

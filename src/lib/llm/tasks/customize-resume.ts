import { callLlmJson } from "../service";
import { SAFETY_SYSTEM_PROMPT, buildUserPrompt } from "../prompts";
import type { LlmEnvelope, LlmTaskCallMeta } from "../types";

export interface ResumeChangeSummaryItem {
  title: string;
  detail: string;
}

export interface ResumeCustomizationResult {
  contentText: string;
  changeSummary: ResumeChangeSummaryItem[];
  keywordsCovered: string[];
}

export async function customizeResumeForJob(input: {
  resumeText: string;
  experienceSummary: string;
  jdText: string;
  jobKeywords: string[];
}): Promise<{ envelope: LlmEnvelope<ResumeCustomizationResult>; meta: LlmTaskCallMeta }> {
  const systemPrompt = `${SAFETY_SYSTEM_PROMPT}

任务：基于用户的原始简历、经历库信息和目标 JD，生成一份"岗位定制简历草稿"。

允许做的事：调整经历顺序、强化和 JD 相关的关键词、改写表达方式让描述更贴合 JD、突出更相关的项目。
不允许做的事：编造原简历/经历库里没有的实习、项目、技能、公司、学校、证书；编造未经确认的量化数据（比如凭空写"提升30%"）。

"result" 字段必须是一个对象：
{
  "contentText": string,   // 定制后的简历正文，用纯文本或简单的 Markdown 结构（## 小标题 + - 列表）
  "changeSummary": [{ "title": string, "detail": string }],  // 关键改写点说明，每条一个标题+说明
  "keywordsCovered": string[]  // 本次定制覆盖到的 JD 关键词
}

如果原简历里缺少支撑某个 JD 要求的具体数据，"contentText" 里只能写"待补充"或类似的保守表述，不能自己编一个数字，并且要在 pending_confirmations 里提出对应的问题。`;

  const userPrompt = buildUserPrompt({
    原始简历: input.resumeText,
    经历库摘要: input.experienceSummary,
    "目标 JD": input.jdText,
    "JD 关键词": input.jobKeywords.join("、") || "(无)",
  });

  return callLlmJson<ResumeCustomizationResult>("resume_customization", [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
}

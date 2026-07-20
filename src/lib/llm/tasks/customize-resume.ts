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
  "contentText": string,   // 定制后的简历正文，必须严格遵守下面的排版格式
  "changeSummary": [{ "title": string, "detail": string }],  // 关键改写点说明，每条一个标题+说明
  "keywordsCovered": string[]  // 本次定制覆盖到的 JD 关键词
}

"contentText" 必须严格按下面这套排版格式书写（这是为了后续能自动生成排版工整的 PDF，不能随意发挥）：

\`\`\`
## 分区标题（例如：教育经历 / 实习经历 / 项目经历 / 校园经历 / 技能）
机构或学校名 · 角色或专业 | 起止时间
- 要点一
- 要点二

## 下一个分区标题
...
\`\`\`

规则：
1. 每个分区必须以"## "开头。
2. 有明确机构/角色/时间的条目，第二行必须写成"机构名 · 角色 | 起止时间"这个格式，用"|"分隔机构信息和时间，不能省略这条分隔线，也不能把时间写进其他地方。
3. 每个条目下面的要点用"- "开头，一行一条。
4. "技能"这类没有机构/时间的分区，可以直接写一段文字或者用"、"分隔的列表，不需要"|"这一行。
5. 不要在分区标题之前写任何正文内容（比如自我评价要单独放一个"## 自我评价"分区，不能放在最前面不加标题）。
6. 不要使用"|"以外的符号（比如"—""-"）来分隔机构和时间，必须用英文或中文竖线"|"或"｜"。

如果原简历里缺少支撑某个 JD 要求的具体数据，要点里只能写"待补充"或类似的保守表述，不能自己编一个数字，并且要在 pending_confirmations 里提出对应的问题。`;

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

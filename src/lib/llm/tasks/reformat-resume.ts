import { callLlmJson } from "../service";
import { SAFETY_SYSTEM_PROMPT, buildUserPrompt } from "../prompts";
import type { LlmEnvelope, LlmTaskCallMeta } from "../types";

export interface ReformatResumeResult {
  contentText: string;
}

/**
 * 把一份简历原始文本"只重排版、不总结、不删减"地整理成符合导出格式规范的正文。
 * 跟 customizeResumeForJob 的关键区别：这里没有目标 JD，不做任何针对岗位的取舍、
 * 改写或强化，唯一目的是把原文已有的内容按 ## 分区 + 机构·角色｜时间 + - 要点
 * 这套格式重新摆放整齐——原文有几条要点、每条要点多详细，输出必须原样保留，
 * 不能因为"精简"把内容压缩成一句话概括。
 */
export async function reformatResumeContent(
  resumeText: string,
): Promise<{ envelope: LlmEnvelope<ReformatResumeResult>; meta: LlmTaskCallMeta }> {
  const systemPrompt = `${SAFETY_SYSTEM_PROMPT}

任务：把用户的简历原文，重新整理排版成规定格式，**不做任何内容层面的总结、压缩、删减或改写**，只是把原文已有的信息重新摆放整齐。

这跟"岗位定制简历"是完全不同的任务：
- 不需要针对任何岗位做取舍、强调或改写用词。
- 原文一条经历下面写了 4 条要点，输出也必须是 4 条要点，不能合并成 1 条。
- 原文一条要点写了 3 行详细内容，输出这条要点也要保留这 3 行的完整信息量，只能做"去掉多余空格、修正明显的排版错乱"这类纯格式清理，不能因为想让排版好看就删减细节。
- 唯一允许的改动是：把原文的顺序、缩进、分段方式，调整成下面这套排版格式；给原文里能识别出的板块加上合适的分区标题。

"result" 字段必须是一个对象：
{
  "contentText": string
}

"contentText" 必须严格按下面这套排版格式书写：

\`\`\`
## 分区标题（例如：教育经历 / 实习经历 / 项目经历 / 校园经历 / 荣誉与技能）
机构或学校名 · 角色或专业 | 起止时间
- 要点一（保留原文完整信息量，不要总结成一句话）
- 要点二

## 下一个分区标题
...
\`\`\`

规则：
1. 每个分区必须以"## "开头。
2. 有明确机构/角色/时间的条目，第二行写成"机构名 · 角色 | 起止时间"，用"|"分隔，不能省略。
3. 每个条目下面的要点用"- "开头，一行一条，数量和详细程度必须跟原文一致。
4. "技能""荣誉"这类没有机构/时间的内容，可以直接写一段文字或者用"、"分隔的列表。
5. 原文里如果有联系方式、姓名这类不属于任何经历分区的信息，不要放进 contentText 里（这些会由系统单独处理），只处理教育/实习/工作/项目/校园/证书/奖项/技能这些经历性内容。
6. 如果原文本身信息就很少、很简略，输出也应该同样简略，不能为了"看起来完整"而编造或补充原文没有的内容。`;

  const userPrompt = buildUserPrompt({
    简历原文: resumeText,
  });

  return callLlmJson<ReformatResumeResult>("resume_reformatting", [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
}

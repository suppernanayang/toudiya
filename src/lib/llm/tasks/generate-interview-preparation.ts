import { callLlmJson } from "../service";
import { SAFETY_SYSTEM_PROMPT, buildUserPrompt } from "../prompts";
import type { LlmEnvelope, LlmTaskCallMeta } from "../types";

export interface StarAnswer {
  question: string;
  situation: string;
  task: string;
  action: string;
  result: string;
}

export interface InterviewPreparationResult {
  selfIntro: string;
  keyExperienceBrief: string[];
  likelyQuestions: string[];
  starAnswers: StarAnswer[];
  businessQuestions: string[];
  skillsToReview: string[];
  questionsToAsk: string[];
}

export async function generateInterviewPreparation(input: {
  jdText: string;
  finalResumeText: string;
  experienceSummary: string;
  applicationMessage: string;
}): Promise<{ envelope: LlmEnvelope<InterviewPreparationResult>; meta: LlmTaskCallMeta }> {
  const systemPrompt = `${SAFETY_SYSTEM_PROMPT}

任务：基于原始 JD、最终投递简历、经历库细节和投递话术，生成面试准备材料。

"result" 字段必须是一个对象：
{
  "selfIntro": string,             // 1 分钟自我介绍草稿
  "keyExperienceBrief": string[],  // 重点经历的简要解释，每条一段
  "likelyQuestions": string[],     // 面试官可能会问的问题
  "starAnswers": [{ "question": string, "situation": string, "task": string, "action": string, "result": string }],
  "businessQuestions": string[],   // 岗位相关的业务/专业问题，用于复习
  "skillsToReview": string[],      // 需要复习的技能或知识点
  "questionsToAsk": string[]       // 可以反问面试官的问题
}

STAR 回答里的 "result" 部分，如果简历里没有明确的量化结果，只能写"待补充"或保守表述，并在 pending_confirmations 里列出对应问题，不能编数字。`;

  const userPrompt = buildUserPrompt({
    "原始 JD": input.jdText,
    最终投递简历: input.finalResumeText,
    经历库细节: input.experienceSummary,
    投递话术: input.applicationMessage,
  });

  return callLlmJson<InterviewPreparationResult>("interview_preparation", [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
}

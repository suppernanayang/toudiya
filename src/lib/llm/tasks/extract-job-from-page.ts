import { callLlmJson } from "../service";
import { SAFETY_SYSTEM_PROMPT, buildUserPrompt } from "../prompts";
import type { LlmEnvelope, LlmTaskCallMeta } from "../types";

export interface JobExtractionFromPageResult {
  isLikelyJobPosting: boolean;
  company: string;
  title: string;
  jdText: string;
  confidence: "high" | "medium" | "low";
}

/**
 * 浏览器插件"一键导入JD"的兜底路径用：
 * 插件在网页里已经用 defuddle 之类的工具把整页降噪成了干净正文，
 * 但还是不知道这段正文具体属于哪个公司、哪个岗位、正文从哪到哪——
 * 这个任务负责从这段正文里把这三个字段拆出来，给用户在插件侧面板确认用。
 *
 * 注意：这里只是"识别"，不涉及写入数据库，也不做任何简历相关的判断，
 * 跟 analyzeJobDescription（拿到确认过的JD做岗位分析）是完全不同的两步。
 */
export async function extractJobFromPageText(input: {
  pageText: string;
  url?: string;
}): Promise<{ envelope: LlmEnvelope<JobExtractionFromPageResult>; meta: LlmTaskCallMeta }> {
  const systemPrompt = `${SAFETY_SYSTEM_PROMPT}

任务：给你一段从网页正文里提取出来的文本（可能是招聘详情页，也可能不是），
判断这段文本是不是一个岗位招聘信息，如果是，从里面识别出公司名、岗位名称、
JD 正文这三块内容。

"result" 字段必须是一个对象：
{
  "isLikelyJobPosting": boolean,  // 这段文本看起来像不像一个岗位招聘详情页
  "company": string,              // 识别出的公司名，识别不出来就是空字符串
  "title": string,                // 识别出的岗位名称，识别不出来就是空字符串
  "jdText": string,               // JD 正文本身（职责、要求等），去掉页面导航/页脚/无关广告文字，
                                   // 但不要改写、不要总结、不要删减正文里已有的信息，原样摘出来
  "confidence": "high" | "medium" | "low"  // 你对这次识别结果的把握程度
}

如果这段文本明显不是招聘信息（比如是篇新闻、是网站首页导航），
isLikelyJobPosting 填 false，其他字段可以留空，不要编造。`;

  const userPrompt = buildUserPrompt({
    "网页正文（已去除导航/广告等噪音）": input.pageText,
    "网页地址": input.url || "(未提供)",
  });

  return callLlmJson<JobExtractionFromPageResult>("job_extraction_from_page", [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
}

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

任务：给你一段从网页里抓取到的文本（可能已经过降噪处理，也可能是整页的原始文字，
里面会掺杂导航栏、页脚、其他不相关内容），判断这段文本里有没有一个岗位招聘信息，
如果有，从里面识别出公司名、岗位名称、JD 正文这三块内容。

有两种常见的页面情况都要能处理：
1. 单个岗位的详情页：整段文本基本上就是这一个岗位的信息，直接提取。
2. 招聘网站的"搜索列表 + 预览"页面：左边是一堆职位的简短卡片（每个只有职位名、
   薪资、公司这种一行摘要），右边是当前选中的那个职位的完整详情（有完整的
   "岗位职责""任职要求"这类分段说明）。遇到这种情况，你要找的是那个内容
   最完整、有清晰"职责/要求"分段说明的那一份，不要把左边列表里其他职位的
   简短摘要当成目标岗位的信息，也不要把好几个不同职位的信息混在一起拼成一份。

"result" 字段必须是一个对象：
{
  "isLikelyJobPosting": boolean,  // 这段文本里有没有找到符合上述特征的岗位详情
  "company": string,              // 识别出的公司名，识别不出来就是空字符串
  "title": string,                // 识别出的岗位名称，识别不出来就是空字符串
  "jdText": string,               // JD 正文本身（职责、要求等），去掉页面导航/页脚/无关广告文字，
                                   // 但不要改写、不要总结、不要删减正文里已有的信息，原样摘出来
  "confidence": "high" | "medium" | "low"  // 你对这次识别结果的把握程度
}

如果通篇没有找到任何一份完整的岗位详情（比如只有一堆职位列表摘要、没有点开
任何一个的详情，或者这段文本明显不是招聘相关内容），isLikelyJobPosting 填
false，其他字段留空，不要编造，也不要拿列表摘要硬凑一份"详情"出来。`;

  const userPrompt = buildUserPrompt({
    "网页抓取到的文本": input.pageText,
    "网页地址": input.url || "(未提供)",
  });

  return callLlmJson<JobExtractionFromPageResult>("job_extraction_from_page", [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
}

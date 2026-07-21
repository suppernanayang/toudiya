import Defuddle from "defuddle";
import type { ExtensionMessage, ExtensionResponse, JdExtractionResult } from "../lib/messages";

// 这个文件会被注入到「除了求职鸭自己」以外的所有网页里，但默认什么都不做，
// 只是挂一个消息监听器，等侧面板发"EXTRACT_JD_IN_TAB"消息过来才真正开始工作，
// 不会自动扫描/上传任何页面内容。

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type !== "EXTRACT_JD_IN_TAB") return;
  extractJd()
    .then((result) => sendResponse({ ok: true, result } satisfies ExtensionResponse))
    .catch((error) => {
      sendResponse({
        ok: false,
        message: error instanceof Error ? error.message : "识别失败，未知错误",
      } satisfies ExtensionResponse);
    });
  return true;
});

async function extractJd(): Promise<JdExtractionResult> {
  const bySelector = trySiteSpecificSelectors();
  if (bySelector) return bySelector;

  // 没有命中已知平台的规则（或者规则暂时失效），走通用兜底：
  // 先尽量抓一份干净正文，再交给后端 AI 识别。
  const cleanedText = extractCleanedPageText();
  if (!cleanedText || cleanedText.length < 30) {
    throw new Error("这个页面识别不到什么内容，可能不是招聘详情页，或者页面还没加载完。");
  }

  const response = (await chrome.runtime.sendMessage({
    type: "AI_EXTRACT_JOB_FROM_TEXT",
    pageText: cleanedText,
    url: window.location.href,
  } satisfies ExtensionMessage)) as ExtensionResponse;

  if (!response.ok) throw new Error(response.message);
  if (!("result" in response)) throw new Error("识别结果格式不对。");
  // 不管 AI 认不认得出来，都把实际发给它的原始文本带回去，
  // 侧面板会展示出来，方便识别不准的时候直接看到问题出在"抓错内容"
  // 还是"AI 理解错了"。
  return { ...response.result, debugText: cleanedText.slice(0, 4000) };
}

/**
 * 抓页面正文的策略，按顺序尝试，取第一个"看起来像样"的结果：
 * 1. defuddle 降噪提取——大部分正常的详情页效果最好，噪音最少。
 * 2. 如果 defuddle 抓到的内容太短，或者完全没有 JD 常见关键词
 *    （比如"职责""要求""任职"这些词一个都没有），大概率是 defuddle
 *    在这个网站的复杂布局里没找对区域（很多招聘网站是列表+预览这种
 *    多栏结构，不是简单的单栏文章页，defuddle 的"识别文章正文"算法
 *    容易失效），这时候直接退回整页纯文本，虽然更噪但至少不会漏内容。
 */
function extractCleanedPageText(): string {
  let defuddleText = "";
  try {
    const result = new Defuddle(document).parse();
    defuddleText = (result.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  } catch (error) {
    console.error("[toudiya-extension] defuddle 解析失败：", error);
  }

  if (looksLikeJobContent(defuddleText)) {
    return defuddleText;
  }

  const rawText = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
  // 整页纯文本可能很长（尤其是列表+预览这种页面，一堆职位卡片文字都在），
  // 截断到一个既能覆盖正文、又不会让 AI 调用太贵太慢的长度。
  const truncated = rawText.slice(0, 12000);

  // defuddle 结果虽然没命中关键词，但比整页纯文本更干净，
  // 而且整页纯文本也没有关键词命中的话，还是优先用 defuddle 的结果
  // （信息量更聚焦），除非它比整页纯文本短得多，那更可能是没抓对区域。
  if (defuddleText && defuddleText.length >= truncated.length * 0.3) {
    return defuddleText;
  }
  return truncated || defuddleText;
}

const JD_KEYWORDS = ["岗位职责", "工作职责", "任职要求", "任职资格", "岗位要求", "职位描述", "职位职责"];

function looksLikeJobContent(text: string): boolean {
  if (!text || text.length < 200) return false;
  return JD_KEYWORDS.some((keyword) => text.includes(keyword));
}

// ---------------------------------------------------------------------------
// 已知平台的精确选择器规则。
//
// 重要说明：下面 Boss 直聘的选择器是根据公开资料/历史经验写的猜测值，
// 没有条件实机验证过（Boss 直聘对非浏览器请求会返回反爬验证页，没法直接
// 抓到真实 DOM 结构核实）。如果装上插件之后发现 Boss 直聘识别不出来，
// 大概率是这几个选择器字符串需要根据实际页面结构调整——用浏览器开发者工具
// 看一下真实的 class 名，改这里就行，不需要动其他逻辑。
// 找不到任何一个候选选择器时，会自动降级走下面的通用兜底路径，不会直接报错。
// ---------------------------------------------------------------------------

interface SiteRule {
  hostnamePattern: RegExp;
  titleSelectors: string[];
  companySelectors: string[];
  jdTextSelectors: string[];
}

const SITE_RULES: SiteRule[] = [
  {
    hostnamePattern: /(^|\.)zhipin\.com$/,
    titleSelectors: [".job-name", ".job-title", ".job-banner .name", "h1.name"],
    companySelectors: [".job-boss-info .name", ".company-info .name", ".job-primary .name", ".sider-company .name"],
    jdTextSelectors: [".job-sec-text", ".job-detail .text", ".job-detail-section .text", ".desc-content"],
  },
];

function trySiteSpecificSelectors(): JdExtractionResult | null {
  const rule = SITE_RULES.find((r) => r.hostnamePattern.test(window.location.hostname));
  if (!rule) return null;

  const title = firstMatchText(rule.titleSelectors);
  const company = firstMatchText(rule.companySelectors);
  const jdText = firstMatchText(rule.jdTextSelectors);

  // 标题和正文任何一个没找到，都认为这套规则失效了，交给通用兜底处理，
  // 不要拿一份缺胳膊少腿的结果去骗用户"识别成功了"。
  if (!title || !jdText) return null;

  return {
    isLikelyJobPosting: true,
    company: company || "",
    title,
    jdText,
    confidence: company ? "high" : "medium",
    source: "selector",
  };
}

function firstMatchText(selectors: string[]): string {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const text = el?.textContent?.trim();
    if (text) return text;
  }
  return "";
}

import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { registerResumeFonts } from "./fonts";
import { parseResumeContent } from "./parse-resume-content";
import { ResumeDocument, MIN_RESUME_SCALE } from "./ResumeDocument";

export interface GenerateResumePdfInput {
  name: string;
  targetRole?: string | null;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarAbsolutePath?: string | null;
  contentText: string;
  /**
   * 手动指定缩放系数（比如用户在导出前预览里自己拖动过字号滑块并确认）。
   * 传了这个值就不会再跑"自动缩到 1 页"的逻辑，直接按这个系数渲染一次，
   * 保证导出结果跟预览看到的完全一致。
   */
  scale?: number;
}

export type GenerateResumePdfResult =
  | { ok: true; buffer: Buffer; scale: number; pageCount: number; warning?: string }
  | { ok: false; reason: string };

// 从 1.0 开始，每次内容超过 1 页就整体缩小一档，直到落进 1 页或者到达最小可读字号。
const AUTO_FIT_SCALE_STEPS = [1, 0.95, 0.9, 0.85, MIN_RESUME_SCALE];

export async function generateResumePdf(input: GenerateResumePdfInput): Promise<GenerateResumePdfResult> {
  const parsed = parseResumeContent(input.contentText);
  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason };
  }

  registerResumeFonts();

  const contactParts = [input.phone, input.email].filter(Boolean);
  const subtitleParts = [input.targetRole, input.city].filter(Boolean);

  const renderWithScale = (scale: number) =>
    renderToBuffer(
      React.createElement(ResumeDocument, {
        name: input.name || "未填写姓名",
        subtitle: subtitleParts.join(" · ") || undefined,
        contactLine: contactParts.join("  ·  ") || undefined,
        avatarPath: input.avatarAbsolutePath || undefined,
        resume: parsed.data,
        scale,
      }) as React.ReactElement<DocumentProps>,
    );

  // 手动指定了缩放系数：只渲染这一次，不做自动缩放尝试，保证跟预览一致。
  if (typeof input.scale === "number") {
    const buffer = await renderWithScale(input.scale);
    const pageCount = await countPdfPages(buffer);
    return {
      ok: true,
      buffer,
      scale: input.scale,
      pageCount,
      warning: pageCount > 1 ? "这份简历目前是多页，如果需要 1 页，请回到预览里调小字号再导出。" : undefined,
    };
  }

  // 没有手动指定：自动从 100% 开始尝试，内容超过 1 页就逐档缩小，直到落进 1 页或缩到底。
  let scale = AUTO_FIT_SCALE_STEPS[0];
  let buffer = await renderWithScale(scale);
  let pageCount = await countPdfPages(buffer);

  for (let i = 1; i < AUTO_FIT_SCALE_STEPS.length && pageCount > 1; i++) {
    scale = AUTO_FIT_SCALE_STEPS[i];
    buffer = await renderWithScale(scale);
    pageCount = await countPdfPages(buffer);
  }

  return {
    ok: true,
    buffer,
    scale,
    pageCount,
    warning:
      pageCount > 1
        ? "这份简历内容偏多，已经自动把字号和间距缩到最小可读程度，仍然超过 1 页。建议精简一些内容，或者去预览里确认接受多页。"
        : undefined,
  };
}

async function countPdfPages(buffer: Buffer): Promise<number> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const info = await parser.getInfo();
    return info.total;
  } finally {
    await parser.destroy();
  }
}

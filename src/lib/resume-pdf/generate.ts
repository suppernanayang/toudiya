import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { registerResumeFonts } from "./fonts";
import { parseResumeContent } from "./parse-resume-content";
import { ResumeDocument } from "./ResumeDocument";

export interface GenerateResumePdfInput {
  name: string;
  targetRole?: string | null;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
  contentText: string;
}

export type GenerateResumePdfResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; reason: string };

export async function generateResumePdf(input: GenerateResumePdfInput): Promise<GenerateResumePdfResult> {
  const parsed = parseResumeContent(input.contentText);
  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason };
  }

  registerResumeFonts();

  const contactParts = [input.phone, input.email].filter(Boolean);
  const subtitleParts = [input.targetRole, input.city].filter(Boolean);

  const buffer = await renderToBuffer(
    React.createElement(ResumeDocument, {
      name: input.name || "未填写姓名",
      subtitle: subtitleParts.join(" · ") || undefined,
      contactLine: contactParts.join("  ·  ") || undefined,
      resume: parsed.data,
    }) as React.ReactElement<DocumentProps>,
  );

  return { ok: true, buffer };
}

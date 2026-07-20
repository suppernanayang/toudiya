import mammoth from "mammoth";

export interface ParsedDocumentResult {
  text: string;
  warning?: string;
}

/**
 * 解析用户上传的简历文件（PDF / Word / 纯文本）。
 * 解析失败时不抛出到中断流程，而是返回空文本 + warning，
 * 让上层提示用户"解析失败，可以改为粘贴文本"，符合 TECH_SPEC 的错误处理要求。
 */
export async function parseResumeFile(
  buffer: Buffer,
  filename: string,
): Promise<ParsedDocumentResult> {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  try {
    if (ext === "pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      await parser.destroy();
      return { text: result.text.trim() };
    }

    if (ext === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value.trim() };
    }

    if (ext === "doc") {
      return {
        text: "",
        warning:
          "暂不支持解析老版 .doc 格式，请另存为 .docx 后重新上传，或直接粘贴简历文本。",
      };
    }

    if (ext === "txt") {
      return { text: buffer.toString("utf-8").trim() };
    }

    return {
      text: "",
      warning: `不支持的文件格式：.${ext}，请上传 PDF / DOCX，或直接粘贴文本。`,
    };
  } catch (error) {
    return {
      text: "",
      warning: `文件解析失败（${
        error instanceof Error ? error.message : String(error)
      }），文件已保留，可以改为粘贴文本或重新上传。`,
    };
  }
}

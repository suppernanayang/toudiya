import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

const STORAGE_ROOT = path.join(process.cwd(), "storage");

const CONTENT_TYPE: Record<string, string> = {
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
};

/**
 * 只允许下载 storage/ 目录下的文件，防止路径穿越读取项目其它文件
 * （比如 .env、prisma/schema.prisma 之类）。
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const relative = segments.join("/");
  const absolutePath = path.join(process.cwd(), relative);

  if (!absolutePath.startsWith(STORAGE_ROOT)) {
    return NextResponse.json({ error: "禁止访问该路径" }, { status: 403 });
  }

  try {
    const file = await fs.readFile(absolutePath);
    const ext = absolutePath.split(".").pop()?.toLowerCase() || "";
    const filename = path.basename(absolutePath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": CONTENT_TYPE[ext] || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }
}

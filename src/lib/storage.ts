import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// 本地文件存储的根目录，结构见 DATA_MODEL_SPEC.md 第 2 节。
const STORAGE_ROOT = path.join(process.cwd(), "storage");

export type ResumeFileFolder =
  | "originals"
  | "ai-drafts"
  | "edited"
  | "uploaded-finals"
  | "submitted";

const RESUME_FOLDER_MAP: Record<ResumeFileFolder, string> = {
  originals: "resumes/originals",
  "ai-drafts": "resumes/ai-drafts",
  edited: "resumes/edited",
  "uploaded-finals": "resumes/uploaded-finals",
  submitted: "resumes/submitted",
};

function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "x";
}

/**
 * 保存一份简历相关文件到本地 storage/，文件名遵循
 * `<user_id>_<job_id>_<resume_version_id>_<version_type>.<ext>` 的约定。
 * 不覆盖旧文件：如果同名文件已存在，会自动加上一个短随机后缀。
 */
export async function saveResumeFile(params: {
  folder: ResumeFileFolder;
  userId: string;
  jobId?: string | null;
  versionId: string;
  versionType: string;
  ext: string;
  content: Buffer | string;
}): Promise<{ relativePath: string; absolutePath: string }> {
  const dir = path.join(STORAGE_ROOT, RESUME_FOLDER_MAP[params.folder]);
  await fs.mkdir(dir, { recursive: true });

  const jobPart = sanitizeSegment(params.jobId || "nojob");
  const ext = params.ext.replace(/^\./, "");
  let filename = `${sanitizeSegment(params.userId)}_${jobPart}_${sanitizeSegment(
    params.versionId,
  )}_${sanitizeSegment(params.versionType)}.${ext}`;

  let absolutePath = path.join(dir, filename);
  if (await fileExists(absolutePath)) {
    filename = `${filename.replace(`.${ext}`, "")}_${randomUUID().slice(0, 6)}.${ext}`;
    absolutePath = path.join(dir, filename);
  }

  await fs.writeFile(absolutePath, params.content);

  const relativePath = path.relative(process.cwd(), absolutePath);
  return { relativePath, absolutePath };
}

export async function readStorageFile(relativePath: string): Promise<Buffer> {
  const absolutePath = path.join(process.cwd(), relativePath);
  return fs.readFile(absolutePath);
}

/**
 * 保存导出文件（比如导出 PDF），跟 saveResumeFile 不同的地方是这类文件
 * 不是"新的简历版本"，只是某个已有版本派生出来的一份可下载产物，
 * 存进 storage/exports/，同一份版本重复导出会直接覆盖旧文件（不需要历史留痕）。
 */
export async function saveExportFile(params: {
  userId: string;
  versionId: string;
  ext: string;
  content: Buffer | string;
}): Promise<{ relativePath: string; absolutePath: string }> {
  const dir = path.join(STORAGE_ROOT, "exports");
  await fs.mkdir(dir, { recursive: true });

  const ext = params.ext.replace(/^\./, "");
  const filename = `${sanitizeSegment(params.userId)}_${sanitizeSegment(params.versionId)}.${ext}`;
  const absolutePath = path.join(dir, filename);

  await fs.writeFile(absolutePath, params.content);

  const relativePath = path.relative(process.cwd(), absolutePath);
  return { relativePath, absolutePath };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

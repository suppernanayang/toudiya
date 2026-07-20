import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import type { ExtractedExperienceItem } from "@/lib/llm";

function normalize(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function sameSet(a: string[] = [], b: string[] = []): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].map(normalize).sort();
  const sortedB = [...b].map(normalize).sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

/**
 * 判断两条经历的"内容"是否完全一致（标题/机构已经在外层判定过一致，
 * 这里比较正文、时间、标签、技能）。
 */
function isContentIdentical(
  existing: { summary: string | null; startDate: string | null; endDate: string | null; tags: unknown; skills: unknown },
  incoming: ExtractedExperienceItem,
): boolean {
  if (normalize(existing.summary) !== normalize(incoming.summary)) return false;
  if (normalize(existing.startDate) !== normalize(incoming.startDate)) return false;
  if (normalize(existing.endDate) !== normalize(incoming.endDate)) return false;
  if (!sameSet((existing.tags as string[]) || [], incoming.tags || [])) return false;
  if (!sameSet((existing.skills as string[]) || [], incoming.skills || [])) return false;
  return true;
}

export type SaveExtractedExperienceOutcome = "created" | "skipped_duplicate" | "flagged_update";

/**
 * 把 AI 提取出的一条经历存进经历库，会先跟当前用户已有的经历做比对：
 * - 类型+标题+机构都一样、且内容也一样 -> 判定为完全重复，跳过，不新建。
 * - 类型+标题+机构一样，但内容不同 -> 新建一条，并关联到旧的那条上，
 *   标记为"待用户确认的更新"，两条会在经历库页面里成组展示。
 * - 否则 -> 作为全新的独立经历新建。
 */
export async function saveExtractedExperienceItem(
  resumeSourceId: string,
  item: ExtractedExperienceItem,
): Promise<SaveExtractedExperienceOutcome> {
  const candidates = await prisma.experienceItem.findMany({
    where: {
      userId: DEFAULT_USER_ID,
      experienceType: item.experienceType,
    },
  });

  const matched = candidates.find(
    (c) => normalize(c.title) === normalize(item.title) && normalize(c.organization) === normalize(item.organization),
  );

  if (matched) {
    if (isContentIdentical(matched, item)) {
      return "skipped_duplicate";
    }

    await prisma.experienceItem.create({
      data: {
        userId: DEFAULT_USER_ID,
        resumeSourceId,
        experienceType: item.experienceType,
        title: item.title,
        organization: item.organization || null,
        role: item.role || null,
        startDate: item.startDate || null,
        endDate: item.endDate || null,
        summary: item.summary,
        tags: item.tags,
        skills: item.skills,
        evidenceStatus: item.evidenceStatus,
        duplicateOfId: matched.id,
      },
    });
    return "flagged_update";
  }

  await prisma.experienceItem.create({
    data: {
      userId: DEFAULT_USER_ID,
      resumeSourceId,
      experienceType: item.experienceType,
      title: item.title,
      organization: item.organization || null,
      role: item.role || null,
      startDate: item.startDate || null,
      endDate: item.endDate || null,
      summary: item.summary,
      tags: item.tags,
      skills: item.skills,
      evidenceStatus: item.evidenceStatus,
    },
  });
  return "created";
}

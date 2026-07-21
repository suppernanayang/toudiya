import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { EXPERIENCE_CATEGORIES } from "@/lib/experience-categories";

const DEFAULT_SESSION_NAME = "常规审核";

// 简历版本"质量"优先级：格式化版 > 方向简历 > 原始版。
// 原始版是从上传文件里直接提取出来的纯文本，没有"## 分区标题"这套排版约定，
// 直接拿去定制/预览/导出都会因为格式不对被拒绝，只应该在没有更好版本时才退回它。
const BASE_VERSION_TYPE_PRIORITY: Record<string, number> = {
  formatted: 0,
  direction: 1,
  original: 2,
};

/**
 * 把候选简历版本按质量优先排序（同类型内按创建时间新的排前面）。
 * "挑基准简历版本"这件事在这个文件和 review/actions.ts 里出现了好几处，
 * 之前各自写了一份逻辑，有的甚至漏掉了"formatted"类型，
 * 统一用这个函数，避免同一个 bug 改了一处漏了另一处。
 */
export function sortVersionsByQuality<T extends { versionType: string; createdAt: Date }>(versions: T[]): T[] {
  return [...versions].sort((a, b) => {
    const pa = BASE_VERSION_TYPE_PRIORITY[a.versionType] ?? 99;
    const pb = BASE_VERSION_TYPE_PRIORITY[b.versionType] ?? 99;
    if (pa !== pb) return pa - pb;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export async function ensureDefaultReviewSession() {
  const existing = await prisma.reviewSession.findFirst({
    where: { userId: DEFAULT_USER_ID, status: "in_progress" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  return prisma.reviewSession.create({
    data: { userId: DEFAULT_USER_ID, name: DEFAULT_SESSION_NAME, status: "in_progress" },
  });
}

/**
 * 找一份最合适的"基准简历版本"：优先匹配岗位类型对应的默认方向简历，
 * 找不到就退回任意默认简历，再退回最新的原始简历版本。
 */
async function pickBaseResumeVersionId(roleType: string | null | undefined) {
  const sources = await prisma.resumeSource.findMany({
    where: { userId: DEFAULT_USER_ID },
    orderBy: { updatedAt: "desc" },
    include: {
      resumeVersions: {
        where: { versionType: { in: ["formatted", "direction", "original"] } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (sources.length === 0) return null;

  const normalizedRole = (roleType || "").trim();

  const picked =
    (normalizedRole &&
      sources.find(
        (s) =>
          s.isDefault &&
          s.targetRoleType &&
          (s.targetRoleType.includes(normalizedRole) || normalizedRole.includes(s.targetRoleType)),
      )) ||
    sources.find((s) => s.isDefault) ||
    sources[0];

  return sortVersionsByQuality(picked?.resumeVersions ?? [])[0]?.id ?? null;
}

export async function ensureReviewItemForJob(jobId: string) {
  const session = await ensureDefaultReviewSession();

  const existing = await prisma.reviewItem.findFirst({
    where: { reviewSessionId: session.id, jobId },
  });
  if (existing) return existing;

  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { jobAnalysis: true } });
  const recommendedResumeVersionId = await pickBaseResumeVersionId(job?.jobAnalysis?.roleType);

  return prisma.reviewItem.create({
    data: {
      reviewSessionId: session.id,
      jobId,
      recommendedResumeVersionId,
      currentSelectedResumeVersionId: recommendedResumeVersionId,
    },
  });
}

/** 汇总经历库内容，拼成给 AI 用的"经历库摘要"文本。 */
export async function buildExperienceSummaryText(): Promise<string> {
  const items = await prisma.experienceItem.findMany({
    where: { userId: DEFAULT_USER_ID },
    orderBy: { createdAt: "desc" },
  });

  if (items.length === 0) return "(经历库暂无内容)";

  const formatItem = (item: (typeof items)[number]) => {
    const period = [item.startDate, item.endDate].filter(Boolean).join(" - ");
    const skillsText =
      item.experienceType === "skill" && Array.isArray(item.skills) && item.skills.length > 0
        ? `技能关键词：${(item.skills as string[]).join("、")}`
        : item.summary || "(暂无描述)";
    return `- ${item.title}${item.organization ? `（${item.organization}）` : ""}${
      period ? ` ${period}` : ""
    }：${skillsText} | 证据状态：${item.evidenceStatus}`;
  };

  // 按分类分组，让 AI 更容易对齐简历的分区结构，而不是拿到一整段拍平的经历列表。
  const sections = EXPERIENCE_CATEGORIES.map((category) => {
    const categoryItems = items.filter((item) => category.types.includes(item.experienceType as never));
    if (categoryItems.length === 0) return null;
    return `【${category.label}】\n${categoryItems.map(formatItem).join("\n")}`;
  }).filter(Boolean);

  const categorizedTypes = new Set(EXPERIENCE_CATEGORIES.flatMap((c) => c.types as string[]));
  const uncategorized = items.filter((item) => !categorizedTypes.has(item.experienceType));
  if (uncategorized.length > 0) {
    sections.push(`【其他】\n${uncategorized.map(formatItem).join("\n")}`);
  }

  return sections.join("\n\n");
}

export async function getReviewQueue() {
  const jobs = await prisma.job.findMany({
    where: {
      userId: DEFAULT_USER_ID,
      jobAnalysis: { isNot: null },
    },
    orderBy: { createdAt: "desc" },
    include: { jobAnalysis: true },
  });

  const queue = [];
  for (const job of jobs) {
    const reviewItem = await ensureReviewItemForJob(job.id);
    queue.push({ job, reviewItem });
  }
  return queue;
}

export async function getReviewJobDetail(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { jobAnalysis: true } });
  if (!job) return null;

  const reviewItem = await ensureReviewItemForJob(jobId);

  const [recommendedVersion, currentVersion, finalVersion, jobScopedVersions] = await Promise.all([
    reviewItem.recommendedResumeVersionId
      ? prisma.resumeVersion.findUnique({ where: { id: reviewItem.recommendedResumeVersionId } })
      : null,
    reviewItem.currentSelectedResumeVersionId
      ? prisma.resumeVersion.findUnique({ where: { id: reviewItem.currentSelectedResumeVersionId } })
      : null,
    reviewItem.finalResumeVersionId
      ? prisma.resumeVersion.findUnique({ where: { id: reviewItem.finalResumeVersionId } })
      : null,
    // 这个岗位名下产生的所有版本：AI 草稿、平台内编辑版、用户上传最终版都是 jobId = 这个岗位。
    prisma.resumeVersion.findMany({
      where: { userId: DEFAULT_USER_ID, jobId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const aiDraftVersion = jobScopedVersions.find((v) => v.id === reviewItem.aiDraftResumeVersionId) || null;

  // 基准版通常不属于任何岗位（jobId 为空，来自简历库），单独拼进列表最前面。
  const allVersions = [
    ...(recommendedVersion && !jobScopedVersions.some((v) => v.id === recommendedVersion.id)
      ? [recommendedVersion]
      : []),
    ...jobScopedVersions,
  ];

  // 供"更换基准简历"选择器使用：每份简历来源 + 它质量最好的一个版本。
  const resumeSourceOptions = await prisma.resumeSource.findMany({
    where: { userId: DEFAULT_USER_ID },
    orderBy: { updatedAt: "desc" },
    include: {
      resumeVersions: {
        where: { versionType: { in: ["formatted", "direction", "original"] } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return {
    job,
    reviewItem,
    recommendedVersion,
    aiDraftVersion,
    currentVersion,
    finalVersion,
    allVersions,
    resumeSourceOptions: resumeSourceOptions
      .map((s) => ({ source: s, best: sortVersionsByQuality(s.resumeVersions)[0] }))
      .filter((s) => s.best)
      .map(({ source: s, best }) => ({
        resumeSourceId: s.id,
        name: s.name,
        targetRoleType: s.targetRoleType,
        isDefault: s.isDefault,
        latestVersionId: best.id,
      })),
  };
}

import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";

const DEFAULT_SESSION_NAME = "常规审核";

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
        where: { versionType: { in: ["original", "direction"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (sources.length === 0) return null;

  const normalizedRole = (roleType || "").trim();

  let picked =
    (normalizedRole &&
      sources.find(
        (s) =>
          s.isDefault &&
          s.targetRoleType &&
          (s.targetRoleType.includes(normalizedRole) || normalizedRole.includes(s.targetRoleType)),
      )) ||
    sources.find((s) => s.isDefault) ||
    sources[0];

  return picked?.resumeVersions[0]?.id ?? null;
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

  return items
    .map((item) => {
      const period = [item.startDate, item.endDate].filter(Boolean).join(" - ");
      return `- [${item.experienceType}] ${item.title}${item.organization ? `（${item.organization}）` : ""}${
        period ? ` ${period}` : ""
      }：${item.summary || "(暂无描述)"} | 证据状态：${item.evidenceStatus}`;
    })
    .join("\n");
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

  const [recommendedVersion, aiDraftVersion, currentVersion, finalVersion] = await Promise.all([
    reviewItem.recommendedResumeVersionId
      ? prisma.resumeVersion.findUnique({ where: { id: reviewItem.recommendedResumeVersionId } })
      : null,
    reviewItem.aiDraftResumeVersionId
      ? prisma.resumeVersion.findUnique({ where: { id: reviewItem.aiDraftResumeVersionId } })
      : null,
    reviewItem.currentSelectedResumeVersionId
      ? prisma.resumeVersion.findUnique({ where: { id: reviewItem.currentSelectedResumeVersionId } })
      : null,
    reviewItem.finalResumeVersionId
      ? prisma.resumeVersion.findUnique({ where: { id: reviewItem.finalResumeVersionId } })
      : null,
  ]);

  return { job, reviewItem, recommendedVersion, aiDraftVersion, currentVersion, finalVersion };
}

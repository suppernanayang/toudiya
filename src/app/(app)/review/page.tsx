import { PageShell } from "@/components/layout/PageShell";
import { getReviewQueue, getReviewJobDetail } from "@/lib/review";
import { ReviewDeskClient, type QueueItem, type ReviewDetail } from "./ReviewDeskClient";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const params = await searchParams;
  const queueRaw = await getReviewQueue();

  const queue: QueueItem[] = queueRaw.map(({ job, reviewItem }) => ({
    jobId: job.id,
    company: job.company,
    title: job.title,
    city: job.city,
    status: job.status,
    decision: reviewItem.decision,
    summary: job.jobAnalysis?.summary || null,
    keywords: (job.jobAnalysis?.keywords as string[] | null) || [],
  }));

  const selectedJobId = params.job && queue.some((q) => q.jobId === params.job) ? params.job : queue[0]?.jobId;

  let detail: ReviewDetail | null = null;
  if (selectedJobId) {
    const raw = await getReviewJobDetail(selectedJobId);
    if (raw) {
      detail = {
        jobId: raw.job.id,
        company: raw.job.company,
        title: raw.job.title,
        jdRawText: raw.job.jdRawText,
        status: raw.job.status,
        summary: raw.job.jobAnalysis?.summary || null,
        keywords: (raw.job.jobAnalysis?.keywords as string[] | null) || [],
        hardRequirements: (raw.job.jobAnalysis?.hardRequirements as string[] | null) || [],
        riskFlags: (raw.job.jobAnalysis?.riskFlags as string[] | null) || [],
        reviewItemId: raw.reviewItem.id,
        decision: raw.reviewItem.decision,
        applicationMessage: raw.reviewItem.applicationMessage,
        finalResumeVersionId: raw.reviewItem.finalResumeVersionId,
        currentSelectedResumeVersionId: raw.reviewItem.currentSelectedResumeVersionId,
        recommendedVersion: raw.recommendedVersion
          ? {
              id: raw.recommendedVersion.id,
              versionName: raw.recommendedVersion.versionName,
              versionType: raw.recommendedVersion.versionType,
              contentText: raw.recommendedVersion.contentText,
              filePath: raw.recommendedVersion.filePath,
            }
          : null,
        aiDraftVersion: raw.aiDraftVersion
          ? {
              id: raw.aiDraftVersion.id,
              versionName: raw.aiDraftVersion.versionName,
              versionType: raw.aiDraftVersion.versionType,
              contentText: raw.aiDraftVersion.contentText,
              filePath: raw.aiDraftVersion.filePath,
              changeSummary: (raw.aiDraftVersion.changeSummary as { title: string; detail: string }[] | null) || [],
              riskNotes: (raw.aiDraftVersion.riskNotes as string[] | null) || [],
              pendingConfirmations: (raw.aiDraftVersion.pendingConfirmations as string[] | null) || [],
            }
          : null,
        currentVersion: raw.currentVersion
          ? {
              id: raw.currentVersion.id,
              versionName: raw.currentVersion.versionName,
              versionType: raw.currentVersion.versionType,
              contentText: raw.currentVersion.contentText,
              filePath: raw.currentVersion.filePath,
            }
          : null,
        finalVersion: raw.finalVersion
          ? {
              id: raw.finalVersion.id,
              versionName: raw.finalVersion.versionName,
              versionType: raw.finalVersion.versionType,
              contentText: raw.finalVersion.contentText,
              filePath: raw.finalVersion.filePath,
            }
          : null,
        allVersions: raw.allVersions.map((v) => ({
          id: v.id,
          versionName: v.versionName,
          versionType: v.versionType,
          contentText: v.contentText,
          filePath: v.filePath,
        })),
        resumeSourceOptions: raw.resumeSourceOptions,
      };
    }
  }

  const pendingCount = detail?.aiDraftVersion?.pendingConfirmations?.length || 0;

  return (
    <PageShell
      title="今日投递审核"
      subtitle={`${queue.length} 个岗位待处理${pendingCount ? ` · ${pendingCount} 项事实待补充` : ""}`}
    >
      <ReviewDeskClient queue={queue} detail={detail} />
    </PageShell>
  );
}

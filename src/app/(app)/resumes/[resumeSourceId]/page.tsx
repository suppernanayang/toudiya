import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { PageShell } from "@/components/layout/PageShell";
import { ResumeSourceDetailClient, type ResumeSourceDetail, type ResumeVersionSummary } from "./ResumeSourceDetailClient";

export default async function ResumeSourceDetailPage({
  params,
}: {
  params: Promise<{ resumeSourceId: string }>;
}) {
  const { resumeSourceId } = await params;

  const resumeSource = await prisma.resumeSource.findFirst({
    where: { id: resumeSourceId, userId: DEFAULT_USER_ID },
    include: {
      resumeVersions: { orderBy: { createdAt: "desc" } },
      _count: { select: { experienceItems: true } },
    },
  });

  if (!resumeSource) notFound();

  const versions: ResumeVersionSummary[] = resumeSource.resumeVersions.map((v) => ({
    id: v.id,
    versionName: v.versionName,
    versionType: v.versionType,
    contentText: v.contentText,
    filePath: v.filePath,
    jobId: v.jobId,
    createdAt: v.createdAt.toISOString(),
  }));

  const detail: ResumeSourceDetail = {
    id: resumeSource.id,
    name: resumeSource.name,
    targetRoleType: resumeSource.targetRoleType,
    isDefault: resumeSource.isDefault,
    experienceCount: resumeSource._count.experienceItems,
    versions,
  };

  return (
    <PageShell
      title={resumeSource.name}
      subtitle="简历详情：查看所有版本、编辑内容、导出 PDF"
      actions={
        <Link href="/resumes" className="min-h-9 rounded-lg inline-flex items-center px-3 text-sm border border-line">
          返回简历库
        </Link>
      }
    >
      <ResumeSourceDetailClient detail={detail} />
    </PageShell>
  );
}

import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { PageShell } from "@/components/layout/PageShell";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Tag, TagVariant } from "@/components/ui/Tag";
import Link from "next/link";
import { ResumeIntakeTabs } from "./IntakeTabs";
import { PersonalInfoForm } from "./PersonalInfoForm";
import { ResumePdfPreviewButton } from "@/components/resume-pdf/ResumePdfPreviewButton";

const SOURCE_LABEL: Record<string, { label: string; variant: TagVariant }> = {
  original_upload: { label: "原始版", variant: "default" },
  direction_resume: { label: "方向简历", variant: "blue" },
  manual_created: { label: "手动创建", variant: "default" },
  imported: { label: "导入", variant: "default" },
};

const VERSION_LABEL: Record<string, { label: string; variant: TagVariant }> = {
  original: { label: "原始版", variant: "default" },
  direction: { label: "方向简历", variant: "blue" },
  formatted: { label: "格式化版", variant: "teal" },
  ai_draft: { label: "AI 草稿", variant: "teal" },
  platform_edited: { label: "平台内编辑版", variant: "amber" },
  user_uploaded_final: { label: "用户上传最终版", variant: "green" },
  submitted_final: { label: "已投递最终版", variant: "green" },
};

export default async function ResumesPage({
  searchParams,
}: {
  searchParams: Promise<{ warning?: string; success?: string }>;
}) {
  const params = await searchParams;

  const sources = await prisma.resumeSource.findMany({
    where: { userId: DEFAULT_USER_ID },
    orderBy: { updatedAt: "desc" },
    include: {
      resumeVersions: { orderBy: { createdAt: "desc" } },
      _count: { select: { experienceItems: true } },
    },
  });

  const user = await prisma.user.findUnique({ where: { id: DEFAULT_USER_ID } });

  return (
    <PageShell title="简历库" subtitle="所有版本默认留痕，不覆盖旧版">
      {params.warning ? (
        <div className="border border-amber-soft bg-amber-soft text-[#7c3b07] rounded-lg px-4 py-3 text-sm">
          {params.warning}
        </div>
      ) : null}
      {params.success ? (
        <div className="border border-[#bfe3cc] bg-[#e7f6ec] text-green rounded-lg px-4 py-3 text-sm">
          简历已保存，经历库已同步更新。
        </div>
      ) : null}

      <Panel>
        <PanelHeader title="个人信息" subtitle="导出 PDF 简历的抬头信息，只需要填一次" />
        <PersonalInfoForm
          initialName={user?.name === "我" ? "" : user?.name || ""}
          initialEmail={user?.email || ""}
          initialPhone={user?.phone || ""}
          avatarUrl={user?.avatarPath ? `/api/files/${encodeURIComponent(user.avatarPath)}` : null}
        />
      </Panel>

      <Panel>
        <PanelHeader title="新建简历" subtitle="支持粘贴文本或上传文件，两种方式都会生成一条可追溯的原始版本" />
        <ResumeIntakeTabs />
      </Panel>

      <Panel>
        <PanelHeader title="简历库" subtitle="按最近更新排序" action={<span className="text-muted text-sm">共 {sources.length} 份</span>} />
        {sources.length === 0 ? (
          <div className="p-4 text-muted text-sm">还没有简历，先在上面粘贴文本或上传文件创建第一份。</div>
        ) : (
          <div className="grid [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))] gap-3.5 p-4">
            {sources.map((source) => {
              const sourceInfo = SOURCE_LABEL[source.sourceType] || { label: source.sourceType, variant: "default" as TagVariant };
              const latestVersion = source.resumeVersions[0];
              const boundJobs = new Set(source.resumeVersions.map((v) => v.jobId).filter(Boolean)).size;
              return (
                <div key={source.id} className="border border-line rounded-lg bg-white p-3.5 grid gap-2.5">
                  <Link href={`/resumes/${source.id}`} className="grid gap-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <strong className="text-sm">{source.name}</strong>
                      {source.isDefault ? <Tag variant="blue">方向默认</Tag> : <Tag variant={sourceInfo.variant}>{sourceInfo.label}</Tag>}
                    </div>
                    <div className="text-muted text-xs">
                      {source.targetRoleType ? `方向：${source.targetRoleType} · ` : ""}
                      {source._count.experienceItems} 条经历 · 关联 {boundJobs} 个岗位
                    </div>
                    {latestVersion ? (
                      <div className="flex flex-wrap gap-1.5">
                        {source.resumeVersions.slice(0, 4).map((v) => {
                          const info = VERSION_LABEL[v.versionType] || { label: v.versionType, variant: "default" as TagVariant };
                          return (
                            <Tag key={v.id} variant={info.variant}>
                              {info.label}
                            </Tag>
                          );
                        })}
                      </div>
                    ) : null}
                  </Link>
                  <div className="flex gap-3 text-xs items-start">
                    {latestVersion?.filePath ? (
                      <a href={`/api/files/${encodeURIComponent(latestVersion.filePath)}`} className="text-teal-dark">
                        下载最新版本
                      </a>
                    ) : null}
                    {latestVersion ? <ResumePdfPreviewButton versionId={latestVersion.id} /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </PageShell>
  );
}

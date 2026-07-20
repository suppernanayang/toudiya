import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { PageShell } from "@/components/layout/PageShell";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Tag, TagVariant } from "@/components/ui/Tag";
import { createJobFromText, analyzeJobFormAction } from "./actions";

const STATUS_LABEL: Record<string, { label: string; variant: TagVariant }> = {
  imported: { label: "待分析", variant: "default" },
  analyzed: { label: "已分析", variant: "blue" },
  in_review: { label: "审核中", variant: "teal" },
  ready_to_apply: { label: "待投递", variant: "teal" },
  applied: { label: "已投递", variant: "green" },
  paused: { label: "已暂缓", variant: "amber" },
  rejected_by_user: { label: "已不投", variant: "rose" },
  interviewing: { label: "面试中", variant: "blue" },
  closed: { label: "已关闭", variant: "default" },
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ warning?: string; success?: string }>;
}) {
  const params = await searchParams;

  const jobs = await prisma.job.findMany({
    where: { userId: DEFAULT_USER_ID },
    orderBy: { createdAt: "desc" },
    include: { jobAnalysis: true },
  });

  return (
    <PageShell title="岗位池" subtitle="统一承接 JD 文本、岗位链接、表格导入和后续平台/官网来源岗位">
      {params.warning ? (
        <div className="border border-amber-soft bg-amber-soft text-[#7c3b07] rounded-lg px-4 py-3 text-sm">
          {params.warning}
        </div>
      ) : null}
      {params.success ? (
        <div className="border border-[#bfe3cc] bg-[#e7f6ec] text-green rounded-lg px-4 py-3 text-sm">
          岗位已保存并完成 JD 分析。
        </div>
      ) : null}

      <Panel>
        <PanelHeader title="导入岗位" subtitle="先支持粘贴 JD 文本，表格批量导入留到下一版" />
        <form action={createJobFromText} className="p-4 grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input name="company" type="text" placeholder="公司，例如：小红书" className="h-9 border border-line rounded-lg px-2.5 bg-white" required />
            <input name="title" type="text" placeholder="岗位名称，例如：产品运营实习生" className="h-9 border border-line rounded-lg px-2.5 bg-white" required />
            <input name="url" type="text" placeholder="岗位链接（可选）" className="h-9 border border-line rounded-lg px-2.5 bg-white" />
          </div>
          <textarea
            name="jdText"
            placeholder="粘贴 JD 原文，信息不足时系统会在分析结果里提示需要补充哪些字段"
            className="min-h-40 border border-line rounded-lg bg-white p-3 leading-relaxed"
          />
          <div>
            <button type="submit" className="min-h-9 rounded-lg inline-flex items-center px-3 text-sm border border-teal bg-teal text-white">
              保存并分析
            </button>
          </div>
        </form>
      </Panel>

      <Panel>
        <PanelHeader title="岗位池" subtitle="按最近导入排序" action={<span className="text-muted text-sm">共 {jobs.length} 个</span>} />
        {jobs.length === 0 ? (
          <div className="p-4 text-muted text-sm">还没有岗位，先在上面粘贴一个 JD 试试。</div>
        ) : (
          <div className="grid">
            {jobs.map((job) => {
              const statusInfo = STATUS_LABEL[job.status] || { label: job.status, variant: "default" as TagVariant };
              return (
                <div key={job.id} className="grid gap-2 px-4 py-3.5 border-b border-line last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong className="text-sm">{job.company} · {job.title}</strong>
                      <div className="text-muted text-xs mt-1">
                        {job.city || "城市待补充"} · {job.sourceType === "manual_jd" ? "JD 粘贴" : job.sourceType}
                        {job.url ? (
                          <>
                            {" · "}
                            <a href={job.url} target="_blank" rel="noreferrer" className="text-teal-dark">
                              岗位链接
                            </a>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <Tag variant={statusInfo.variant}>{statusInfo.label}</Tag>
                  </div>
                  {job.jobAnalysis?.summary ? (
                    <p className="m-0 text-sm text-muted leading-relaxed">{job.jobAnalysis.summary}</p>
                  ) : null}
                  {Array.isArray(job.jobAnalysis?.keywords) && (job.jobAnalysis!.keywords as string[]).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(job.jobAnalysis!.keywords as string[]).slice(0, 6).map((kw) => (
                        <Tag key={kw} variant="blue">
                          {kw}
                        </Tag>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-3 pt-1">
                    {job.jobAnalysis ? (
                      <a href={`/review?job=${job.id}`} className="text-teal-dark text-sm">
                        去审核台
                      </a>
                    ) : (
                      <form action={analyzeJobFormAction}>
                        <input type="hidden" name="jobId" value={job.id} />
                        <button type="submit" className="text-teal-dark text-sm underline-offset-2 hover:underline">
                          {job.jdRawText ? "开始分析" : "先补充 JD 正文"}
                        </button>
                      </form>
                    )}
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

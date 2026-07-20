import Link from "next/link";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { PageShell } from "@/components/layout/PageShell";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Tag } from "@/components/ui/Tag";
import { GeneratePrepButton } from "./GeneratePrepButton";
import { ExportButtons } from "./ExportButtons";

interface StarAnswer {
  question: string;
  situation: string;
  task: string;
  action: string;
  result: string;
}

function buildPrepMarkdown(params: {
  company: string;
  title: string;
  selfIntro: string | null;
  keyExperienceBrief: string[];
  likelyQuestions: string[];
  starAnswers: StarAnswer[];
  skillsToReview: string[];
  questionsToAsk: string[];
  riskNotes: string[];
}): string {
  const lines: string[] = [];
  lines.push(`# 面试准备 · ${params.company} ${params.title}`, "");
  lines.push("## 自我介绍草稿", params.selfIntro || "(暂无)", "");
  lines.push("## 重点经历解释", ...params.keyExperienceBrief.map((i) => `- ${i}`), "");
  lines.push("## 可能追问", ...params.likelyQuestions.map((i) => `- ${i}`), "");
  lines.push("## STAR 回答框架");
  params.starAnswers.forEach((s) => {
    lines.push(
      `### ${s.question}`,
      `- 情境：${s.situation}`,
      `- 任务：${s.task}`,
      `- 行动：${s.action}`,
      `- 结果：${s.result}`,
      "",
    );
  });
  lines.push("## 需要复习的业务/技能点", ...params.skillsToReview.map((i) => `- ${i}`), "");
  lines.push("## 反问面试官", ...params.questionsToAsk.map((i) => `- ${i}`), "");
  if (params.riskNotes.length > 0) {
    lines.push("## 风险提醒", ...params.riskNotes.map((i) => `- ${i}`), "");
  }
  return lines.join("\n");
}

export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const params = await searchParams;

  const applications = await prisma.application.findMany({
    where: { userId: DEFAULT_USER_ID },
    orderBy: { updatedAt: "desc" },
    include: { job: true },
  });

  const selectedJobId = params.job || applications[0]?.jobId;
  const selectedJob = selectedJobId ? await prisma.job.findUnique({ where: { id: selectedJobId } }) : null;

  const preparation = selectedJobId
    ? await prisma.interviewPreparation.findFirst({
        where: { jobId: selectedJobId, userId: DEFAULT_USER_ID },
        orderBy: { createdAt: "desc" },
      })
    : null;

  return (
    <PageShell title="面试准备" subtitle="基于最终投递版生成准备材料">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4.5 items-start">
        <Panel>
          <PanelHeader title="已投递岗位" subtitle="选择一个查看/生成面试准备" />
          {applications.length === 0 ? (
            <div className="p-4 text-muted text-sm">还没有投递记录，先去审核台确认投递。</div>
          ) : (
            <div className="grid">
              {applications.map((app) => (
                <Link
                  key={app.id}
                  href={`/interviews?job=${app.jobId}`}
                  className={`block px-4 py-3 border-b border-line last:border-b-0 text-sm ${
                    app.jobId === selectedJobId ? "bg-surface-2" : ""
                  }`}
                >
                  {app.job.company} · {app.job.title}
                </Link>
              ))}
            </div>
          )}
        </Panel>

        {selectedJob ? (
          <Panel>
            <PanelHeader
              title={`面试准备 · ${selectedJob.company} ${selectedJob.title}`}
              subtitle="基于原始 JD、最终投递简历与经历库生成"
              action={preparation?.modelProvider ? <Tag variant="teal">{preparation.modelProvider} · {preparation.modelName}</Tag> : undefined}
            />
            <div className="p-4">
              {!preparation ? (
                <GeneratePrepButton jobId={selectedJob.id} />
              ) : (
                <div className="grid gap-3">
                  <Block title="自我介绍草稿">
                    <p className="m-0 text-muted text-sm leading-relaxed">{preparation.selfIntro}</p>
                  </Block>
                  <Block title="重点经历解释">
                    <List items={(preparation.keyExperienceBrief as string[] | null) || []} />
                  </Block>
                  <Block title="可能追问">
                    <List items={(preparation.likelyQuestions as string[] | null) || []} />
                  </Block>
                  <Block title="STAR 回答框架">
                    <div className="grid gap-3">
                      {((preparation.starAnswers as { question: string; situation: string; task: string; action: string; result: string }[] | null) || []).map(
                        (item, idx) => (
                          <div key={idx} className="border border-line rounded-lg p-3 grid gap-1">
                            <strong className="text-sm">{item.question}</strong>
                            <p className="m-0 text-muted text-sm"><strong>情境：</strong>{item.situation}</p>
                            <p className="m-0 text-muted text-sm"><strong>任务：</strong>{item.task}</p>
                            <p className="m-0 text-muted text-sm"><strong>行动：</strong>{item.action}</p>
                            <p className="m-0 text-muted text-sm"><strong>结果：</strong>{item.result}</p>
                          </div>
                        ),
                      )}
                    </div>
                  </Block>
                  <Block title="需要复习的业务/技能点">
                    <List items={(preparation.skillsToReview as string[] | null) || []} />
                  </Block>
                  <Block title="反问面试官">
                    <List items={(preparation.questionsToAsk as string[] | null) || []} />
                  </Block>
                  {Array.isArray(preparation.riskNotes) && (preparation.riskNotes as string[]).length > 0 ? (
                    <Block title="风险提醒">
                      <List items={preparation.riskNotes as string[]} />
                    </Block>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <ExportButtons
                      content={buildPrepMarkdown({
                        company: selectedJob.company,
                        title: selectedJob.title,
                        selfIntro: preparation.selfIntro,
                        keyExperienceBrief: (preparation.keyExperienceBrief as string[] | null) || [],
                        likelyQuestions: (preparation.likelyQuestions as string[] | null) || [],
                        starAnswers: (preparation.starAnswers as StarAnswer[] | null) || [],
                        skillsToReview: (preparation.skillsToReview as string[] | null) || [],
                        questionsToAsk: (preparation.questionsToAsk as string[] | null) || [],
                        riskNotes: (preparation.riskNotes as string[] | null) || [],
                      })}
                      filename={`面试准备-${selectedJob.company}-${selectedJob.title}.md`}
                    />
                    <GeneratePrepButton jobId={selectedJob.id} />
                  </div>
                </div>
              )}
            </div>
          </Panel>
        ) : (
          <Panel>
            <div className="p-6 text-muted text-sm">左侧选择一个已投递的岗位。</div>
          </Panel>
        )}
      </div>
    </PageShell>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-line rounded-lg p-3.5 bg-white grid gap-2">
      <h3 className="m-0 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="m-0 text-muted text-sm">暂无</p>;
  return (
    <ul className="m-0 pl-4 grid gap-1.5">
      {items.map((item, idx) => (
        <li key={idx} className="text-muted text-sm leading-relaxed">
          {item}
        </li>
      ))}
    </ul>
  );
}

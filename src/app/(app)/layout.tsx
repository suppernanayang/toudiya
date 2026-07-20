import { prisma } from "@/lib/db";
import { ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/current-user";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await ensureDefaultUser();

  const [pendingReviewCount, activeJobCount, llmSetting] = await Promise.all([
    prisma.reviewItem.count({
      where: { decision: "undecided", reviewSession: { userId: DEFAULT_USER_ID } },
    }),
    prisma.job.count({
      where: {
        userId: DEFAULT_USER_ID,
        status: { notIn: ["closed", "rejected_by_user"] },
      },
    }),
    prisma.llmSetting.findUnique({ where: { userId: DEFAULT_USER_ID } }),
  ]);

  const modelSummary = llmSetting
    ? `${llmSetting.defaultProvider === "deepseek" ? "DeepSeek" : "OpenAI"} · ${
        llmSetting.autoFallback ? "自动备用已开" : "自动备用已关"
      }`
    : "未配置";

  return (
    <div className="grid grid-cols-[248px_minmax(360px,1fr)] min-h-screen">
      <Sidebar reviewCount={pendingReviewCount} jobCount={activeJobCount} modelSummary={modelSummary} />
      <main className="min-w-0 flex flex-col">{children}</main>
    </div>
  );
}

import "./load-env";
import { prisma } from "../src/lib/db";
import { DEFAULT_USER_ID } from "../src/lib/current-user";
import { saveExtractedExperienceItem } from "../src/lib/experience";
import type { ExtractedExperienceItem } from "../src/lib/llm";

const TEST_SOURCE_NAME = "验证脚本-去重测试简历";

async function main() {
  console.log("==== 经历去重逻辑验证开始 ====\n");

  // 清理上次留下的测试数据
  const oldSource = await prisma.resumeSource.findFirst({ where: { userId: DEFAULT_USER_ID, name: TEST_SOURCE_NAME } });
  if (oldSource) {
    await prisma.experienceDetail.deleteMany({ where: { experienceItem: { resumeSourceId: oldSource.id } } });
    await prisma.experienceItem.deleteMany({ where: { resumeSourceId: oldSource.id } });
    await prisma.resumeSource.delete({ where: { id: oldSource.id } });
  }

  const source = await prisma.resumeSource.create({
    data: { userId: DEFAULT_USER_ID, name: TEST_SOURCE_NAME, sourceType: "manual_created" },
  });

  const original: ExtractedExperienceItem = {
    experienceType: "internship",
    title: "去重测试实习生",
    organization: "测试公司",
    role: "实习生",
    startDate: "2025-01",
    endDate: "2025-06",
    summary: "负责数据分析和内容运营。",
    tags: ["数据分析"],
    skills: ["Excel"],
    evidenceStatus: "confirmed",
  };

  // 第一次插入：应该是全新创建
  const r1 = await saveExtractedExperienceItem(source.id, original);
  console.log(`第一次插入同一条经历 -> ${r1}（期望 created）`, r1 === "created" ? "✅" : "❌");

  // 第二次插入完全相同的内容：应该被判定为完全重复，跳过
  const r2 = await saveExtractedExperienceItem(source.id, { ...original });
  console.log(`第二次插入一模一样的内容 -> ${r2}（期望 skipped_duplicate）`, r2 === "skipped_duplicate" ? "✅" : "❌");

  // 第三次插入标题机构相同但内容更新：应该被标记为待确认的更新
  const updated: ExtractedExperienceItem = {
    ...original,
    summary: "负责数据分析、内容运营和用户增长，新增了 A/B 测试职责。",
    tags: ["数据分析", "用户增长"],
  };
  const r3 = await saveExtractedExperienceItem(source.id, updated);
  console.log(`第三次插入标题相同但内容更新 -> ${r3}（期望 flagged_update）`, r3 === "flagged_update" ? "✅" : "❌");

  const items = await prisma.experienceItem.findMany({ where: { resumeSourceId: source.id } });
  console.log(`\n最终库里这条经历相关的记录数：${items.length}（期望 2：一条原始 + 一条待确认更新）`, items.length === 2 ? "✅" : "❌");

  const flagged = items.find((i) => i.duplicateOfId);
  console.log(`带 duplicateOfId 标记的记录：${flagged ? "存在" : "不存在"}（期望存在）`, flagged ? "✅" : "❌");

  const allPassed =
    r1 === "created" && r2 === "skipped_duplicate" && r3 === "flagged_update" && items.length === 2 && Boolean(flagged);

  console.log(allPassed ? "\n==== 全部通过 ====" : "\n==== 有验证项未通过，请检查上面标 ❌ 的行 ====");
  if (!allPassed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("验证失败：", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

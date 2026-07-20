import "./load-env";
import { prisma } from "../src/lib/db";

// 清理这次手动测试时因为"重复点击提交"产生的重复简历数据。
// 策略：同名的 resumeSource 只保留"经历数最多、内容最完整"的一份，其余删除。
// 明确保留：验证脚本-测试简历（对应之前 verify-e2e.ts 脚本，用户要求保留）。

async function main() {
  const sources = await prisma.resumeSource.findMany({
    include: { _count: { select: { experienceItems: true, resumeVersions: true } } },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<string, typeof sources>();
  for (const s of sources) {
    if (s.name === "验证脚本-测试简历") continue; // 明确保留，不处理
    const list = groups.get(s.name) || [];
    list.push(s);
    groups.set(s.name, list);
  }

  let deletedSources = 0;
  let deletedExperienceItems = 0;
  let deletedVersions = 0;

  for (const [name, list] of groups) {
    if (list.length <= 1) continue;

    // 选出经历数最多的一份保留，其余视为重复提交产生的冗余数据
    const sorted = [...list].sort((a, b) => b._count.experienceItems - a._count.experienceItems);
    const [keep, ...remove] = sorted;
    console.log(`\n简历「${name}」共 ${list.length} 份重复，保留 ${keep.id}（${keep._count.experienceItems} 条经历），删除其余 ${remove.length} 份`);

    for (const source of remove) {
      const expCount = await prisma.experienceItem.count({ where: { resumeSourceId: source.id } });
      const verCount = await prisma.resumeVersion.count({ where: { resumeSourceId: source.id } });

      await prisma.experienceDetail.deleteMany({ where: { experienceItem: { resumeSourceId: source.id } } });
      await prisma.experienceItem.deleteMany({ where: { resumeSourceId: source.id } });
      await prisma.resumeVersion.deleteMany({ where: { resumeSourceId: source.id } });
      await prisma.resumeSource.delete({ where: { id: source.id } });

      deletedSources += 1;
      deletedExperienceItems += expCount;
      deletedVersions += verCount;
    }
  }

  console.log("\n==== 清理完成 ====");
  console.log(`删除了 ${deletedSources} 份重复简历来源`);
  console.log(`删除了 ${deletedVersions} 条冗余简历版本`);
  console.log(`删除了 ${deletedExperienceItems} 条冗余经历条目`);
}

main()
  .catch((error) => {
    console.error("清理失败：", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

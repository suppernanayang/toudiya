"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * 处理"内容有更新，待确认"的一组经历（旧版本 + 新版本）。
 * - keep_new：留下新版本，删掉旧版本。
 * - keep_old：留下旧版本，删掉新版本。
 * - keep_both：两条都留着，取消它们之间的"待确认"关联，变成两条独立经历。
 */
export async function resolveDuplicateExperience(
  newItemId: string,
  oldItemId: string,
  choice: "keep_new" | "keep_old" | "keep_both",
): Promise<ActionResult> {
  const [newItem, oldItem] = await Promise.all([
    prisma.experienceItem.findUnique({ where: { id: newItemId } }),
    prisma.experienceItem.findUnique({ where: { id: oldItemId } }),
  ]);
  if (!newItem || !oldItem) {
    return { ok: false, message: "这条经历已经不存在了，可能已经被处理过。" };
  }

  if (choice === "keep_new") {
    await prisma.experienceDetail.deleteMany({ where: { experienceItemId: oldItemId } });
    await prisma.experienceItem.delete({ where: { id: oldItemId } });
  } else if (choice === "keep_old") {
    await prisma.experienceDetail.deleteMany({ where: { experienceItemId: newItemId } });
    await prisma.experienceItem.delete({ where: { id: newItemId } });
  } else {
    await prisma.experienceItem.update({ where: { id: newItemId }, data: { duplicateOfId: null } });
  }

  revalidatePath("/experiences");
  return { ok: true };
}

export async function updateExperienceItem(
  id: string,
  data: {
    title: string;
    organization: string;
    role: string;
    startDate: string;
    endDate: string;
    summary: string;
    tags: string[];
  },
): Promise<ActionResult> {
  if (!data.title.trim()) {
    return { ok: false, message: "标题不能为空。" };
  }

  await prisma.experienceItem.update({
    where: { id },
    data: {
      title: data.title.trim(),
      organization: data.organization.trim() || null,
      role: data.role.trim() || null,
      startDate: data.startDate.trim() || null,
      endDate: data.endDate.trim() || null,
      summary: data.summary.trim() || null,
      tags: data.tags,
      // 用户手动编辑过之后，视为已经人工确认过的内容。
      evidenceStatus: "confirmed",
    },
  });

  revalidatePath("/experiences");
  return { ok: true };
}

export async function deleteExperienceItem(id: string): Promise<ActionResult> {
  await prisma.experienceDetail.deleteMany({ where: { experienceItemId: id } });
  await prisma.experienceItem.delete({ where: { id } });
  revalidatePath("/experiences");
  return { ok: true };
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { verifyExtensionToken } from "@/lib/extension-auth";

/**
 * 给"辅助填表"用的只读接口：把姓名/联系方式/教育经历等结构化数据交给插件，
 * 插件自己拿这些数据去跟当前网页表单的字段做匹配（本地词典为主）。
 * 这里只做数据整理，不涉及任何"这个字段该填什么"的猜测逻辑——
 * 猜字段语义是插件那边的事，这个接口只负责如实吐出你在求职鸭里维护的数据。
 */
export async function GET(request: NextRequest) {
  const authorized = await verifyExtensionToken(request);
  if (!authorized) {
    return NextResponse.json({ ok: false, message: "插件未配对或配对码不正确，请先去「浏览器插件」设置页重新连接。" }, { status: 401 });
  }

  const [user, experienceItems] = await Promise.all([
    prisma.user.findUnique({ where: { id: DEFAULT_USER_ID }, include: { profile: true } }),
    prisma.experienceItem.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const byType = (types: string[]) =>
    experienceItems
      .filter((item) => types.includes(item.experienceType))
      .map((item) => ({
        organization: item.organization || "",
        title: item.title,
        role: item.role || "",
        startDate: item.startDate || "",
        endDate: item.endDate || "",
        summary: item.summary || "",
      }));

  const education = byType(["education"]);

  return NextResponse.json({
    ok: true,
    profile: {
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      targetRoles: (user?.profile?.targetRoles as string[] | null) || [],
      targetCities: (user?.profile?.targetCities as string[] | null) || [],
      // 教育背景单独拆出常用字段，方便插件直接匹配"学校/专业/学历"这类表单字段。
      school: education[0]?.organization || "",
      major: education[0]?.title || "",
      education,
      workExperience: byType(["internship", "work"]),
      projects: byType(["project", "portfolio"]),
      campusExperience: byType(["campus"]),
      skillsAndHonors: byType(["certificate", "award", "skill"]),
    },
  });
}

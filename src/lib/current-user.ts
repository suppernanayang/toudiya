import { prisma } from "@/lib/db";

// MVP 是单用户模式，不做登录。所有数据都挂在这一个固定用户下面。
export const DEFAULT_USER_ID = "default-user";

/**
 * 保证默认用户和基础配置存在。正常情况下 `npm run db:seed` 已经建好了，
 * 这里是一个兜底，避免忘记跑 seed 时页面直接报错。
 */
export async function ensureDefaultUser() {
  const user = await prisma.user.upsert({
    where: { id: DEFAULT_USER_ID },
    update: {},
    create: { id: DEFAULT_USER_ID, name: "我" },
  });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  await prisma.llmSetting.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      defaultProvider: "deepseek",
      defaultModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      fallbackProvider: "openai",
      fallbackModel: process.env.OPENAI_MODEL || "gpt-4.1",
      autoFallback: true,
    },
  });

  return user;
}

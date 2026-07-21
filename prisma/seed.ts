import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

// MVP 阶段是单用户模式，用一个固定 id 的默认用户承接所有数据，
// 方便应用代码里直接引用，不需要做登录。
export const DEFAULT_USER_ID = "default-user";

async function main() {
  const user = await prisma.user.upsert({
    where: { id: DEFAULT_USER_ID },
    update: {},
    create: {
      id: DEFAULT_USER_ID,
      name: "我",
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      defaultLanguage: "zh-CN",
    },
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
      taskModelMap: {
        job_analysis: { provider: "deepseek", model: "deepseek-chat" },
        resume_customization: { provider: "deepseek", model: "deepseek-chat" },
        resume_reformatting: { provider: "deepseek", model: "deepseek-chat" },
        application_message: { provider: "deepseek", model: "deepseek-chat" },
        interview_preparation: { provider: "deepseek", model: "deepseek-chat" },
        fact_review: { provider: "deepseek", model: "deepseek-chat" },
        job_extraction_from_page: { provider: "deepseek", model: "deepseek-chat" },
      },
    },
  });

  console.log(`默认用户已就绪：${user.id}`);
}

main()
  .catch((error) => {
    console.error("seed 失败：", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

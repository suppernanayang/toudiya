import "./load-env";
import { spawn } from "child_process";
import path from "path";
import { promises as fs } from "fs";
import { PrismaClient } from "../src/generated/prisma";

const ROOT = path.join(__dirname, "..");
const DEFAULT_PORT = 3000;

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name} — ${detail}`);
}

async function checkStorageDirs() {
  const requiredDirs = [
    "storage/resumes/originals",
    "storage/resumes/ai-drafts",
    "storage/resumes/edited",
    "storage/resumes/uploaded-finals",
    "storage/resumes/submitted",
    "storage/attachments",
    "storage/exports",
    "storage/imports",
  ];

  for (const dir of requiredDirs) {
    const full = path.join(ROOT, dir);
    try {
      const stat = await fs.stat(full);
      if (!stat.isDirectory()) throw new Error("不是目录");
      record(`storage 目录：${dir}`, true, "存在");
    } catch {
      record(`storage 目录：${dir}`, false, "不存在，请检查是否被误删");
    }
  }
}

async function checkDatabase() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { id: "default-user" } });
    if (!user) {
      record("数据库：默认用户", false, "找不到默认用户，请先运行 npm run db:seed");
    } else {
      record("数据库：默认用户", true, `已连接，用户 ${user.id} 存在`);
    }

    const llmSetting = await prisma.llmSetting.findUnique({ where: { userId: "default-user" } });
    record("数据库：模型配置", Boolean(llmSetting), llmSetting ? `默认供应商 ${llmSetting.defaultProvider}` : "未找到 llm_settings 记录");
  } catch (error) {
    record("数据库连接", false, error instanceof Error ? error.message : String(error));
  } finally {
    await prisma.$disconnect();
  }
}

function checkLlmEnv() {
  const deepseekConfigured = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  record(
    "环境变量：DeepSeek Key",
    true,
    deepseekConfigured ? "已配置" : "未配置（.env.local 中 DEEPSEEK_API_KEY 为空）",
  );
  record(
    "环境变量：OpenAI Key",
    true,
    openaiConfigured ? "已配置" : "未配置（.env.local 中 OPENAI_API_KEY 为空，如果没有余额属于预期情况）",
  );
}

function waitForServerReady(port: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  return new Promise((resolve) => {
    const tryOnce = async () => {
      try {
        const res = await fetch(`http://localhost:${port}/dashboard`);
        if (res.status < 500) {
          resolve(true);
          return;
        }
      } catch {
        // 服务器还没起来，继续轮询
      }
      if (Date.now() - start > timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(tryOnce, 500);
    };
    tryOnce();
  });
}

async function checkAppBoots() {
  // Next.js 不允许对同一个项目目录同时跑两个开发服务器实例（哪怕端口不同），
  // 所以如果本机已经有一个 dev server 在跑（比如你自己开着 npm run dev 在浏览），
  // 就直接对它做检查，不再另起一个，避免冲突导致误报失败。
  const alreadyRunning = await waitForServerReady(DEFAULT_PORT, 1500);

  if (alreadyRunning) {
    record("应用启动", true, `检测到已有开发服务器在 http://localhost:${DEFAULT_PORT} 运行，直接使用它`);
    await checkPages(DEFAULT_PORT);
    return;
  }

  const child = spawn("npm", ["run", "dev", "--", "-p", String(DEFAULT_PORT)], {
    cwd: ROOT,
    stdio: "ignore",
    env: process.env,
  });

  try {
    const ready = await waitForServerReady(DEFAULT_PORT, 30000);
    if (!ready) {
      record("应用启动", false, `等待 30 秒后仍无法访问 http://localhost:${DEFAULT_PORT}/dashboard`);
      return;
    }
    record("应用启动", true, "临时启动的开发服务器已就绪");
    await checkPages(DEFAULT_PORT);
  } finally {
    child.kill("SIGTERM");
  }
}

async function checkPages(port: number) {
  const res = await fetch(`http://localhost:${port}/dashboard`);
  record("首页可访问（/dashboard）", res.status === 200, `HTTP ${res.status}`);

  const jobsRes = await fetch(`http://localhost:${port}/jobs`);
  record("岗位池页面可访问（/jobs）", jobsRes.status === 200, `HTTP ${jobsRes.status}`);

  const reviewRes = await fetch(`http://localhost:${port}/review`);
  record("审核台页面可访问（/review）", reviewRes.status === 200, `HTTP ${reviewRes.status}`);

  const experiencesRes = await fetch(`http://localhost:${port}/experiences`);
  record("经历库页面可访问（/experiences）", experiencesRes.status === 200, `HTTP ${experiencesRes.status}`);
}

async function main() {
  console.log("投递鸭冒烟测试\n");

  await checkStorageDirs();
  await checkDatabase();
  checkLlmEnv();
  await checkAppBoots();

  console.log("\n———— 汇总 ————");
  const failed = results.filter((r) => !r.ok);
  console.log(`共 ${results.length} 项检查，通过 ${results.length - failed.length} 项，失败 ${failed.length} 项。`);

  if (failed.length > 0) {
    console.log("\n失败项：");
    failed.forEach((f) => console.log(`- ${f.name}: ${f.detail}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("冒烟测试脚本自身出错：", error);
  process.exit(1);
});

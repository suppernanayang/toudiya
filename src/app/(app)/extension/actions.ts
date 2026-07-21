"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";

/**
 * 获取当前的插件配对 token，没有的话就自动生成一个。
 * 这个 action 只能从求职鸭自己的页面里调用（Server Action 的天然限制——
 * 外部脚本/其他网页没法直接调用它），所以 token 只会经由这个受信任的页面
 * 交给插件（页面加载后用 postMessage 广播给插件的 content script），
 * 不会被随便什么打开着的网页拿到。
 */
export async function getOrCreateExtensionToken(): Promise<{ token: string; lastSeenAt: string | null }> {
  const existing = await prisma.extensionPairing.findUnique({ where: { userId: DEFAULT_USER_ID } });
  if (existing) {
    return { token: existing.token, lastSeenAt: existing.lastSeenAt?.toISOString() ?? null };
  }

  const token = randomBytes(24).toString("hex");
  const created = await prisma.extensionPairing.create({
    data: { userId: DEFAULT_USER_ID, token },
  });
  return { token: created.token, lastSeenAt: null };
}

/**
 * 重新生成一个新 token，让之前配对过的插件失效——用于"插件丢了/怀疑泄露/换电脑"
 * 这类需要手动断开重连的场景。用户点按钮触发，同样通过 postMessage 交给插件。
 */
export async function regenerateExtensionToken(): Promise<{ token: string }> {
  const token = randomBytes(24).toString("hex");
  await prisma.extensionPairing.upsert({
    where: { userId: DEFAULT_USER_ID },
    update: { token, lastSeenAt: null },
    create: { userId: DEFAULT_USER_ID, token },
  });
  revalidatePath("/extension");
  return { token };
}

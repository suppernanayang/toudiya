import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/current-user";

const TOKEN_HEADER = "x-toudiya-extension-token";

/**
 * 校验浏览器插件请求带的配对 token。
 * 用来保护 /api/extension/* 这几个接口，防止其他打开着的网页标签页
 * 悄悄拿这些接口读写数据——插件必须先在"浏览器插件"设置页完成配对，
 * 拿到 token 之后才能调用。
 */
export async function verifyExtensionToken(request: NextRequest): Promise<boolean> {
  const token = request.headers.get(TOKEN_HEADER);
  if (!token) return false;

  const pairing = await prisma.extensionPairing.findUnique({ where: { userId: DEFAULT_USER_ID } });
  if (!pairing) return false;

  const valid = pairing.token === token;
  if (valid) {
    // 更新一下"最近一次看到插件"的时间，给设置页展示"插件已连接/最近活跃时间"用。
    await prisma.extensionPairing.update({
      where: { userId: DEFAULT_USER_ID },
      data: { lastSeenAt: new Date() },
    });
  }
  return valid;
}

export { TOKEN_HEADER as EXTENSION_TOKEN_HEADER };

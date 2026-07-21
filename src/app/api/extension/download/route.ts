import { NextResponse } from "next/server";
import path from "path";
import os from "os";
import { promises as fs } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * 打包好的插件下载入口。不需要 token 校验——这里只是把插件代码本身
 * 打个包给你下载，跟你的简历/岗位/个人信息这些数据完全无关。
 *
 * 直接读 extension/dist（已经 `npm run build` 构建好的产物）打成 zip，
 * 而不是让用户自己装 Node 装依赖跑命令——你只需要点这个按钮下载、解压、
 * 在 chrome://extensions 里加载解压出来的文件夹就行。
 *
 * 用系统自带的 zip 命令打包（macOS/Linux 都有），没有为了这一个功能
 * 专门在项目里加一个打包用的 npm 依赖。
 */
export async function GET() {
  const extensionDistDir = path.join(process.cwd(), "extension", "dist");

  try {
    await fs.access(extensionDistDir);
  } catch {
    return NextResponse.json(
      {
        error:
          "插件还没有构建好（extension/dist 不存在），需要先在 extension/ 目录下执行 npm install && npm run build。",
      },
      { status: 404 },
    );
  }

  const tmpZipPath = path.join(os.tmpdir(), `toudiya-extension-${Date.now()}.zip`);
  try {
    await execFileAsync("zip", ["-r", tmpZipPath, "."], { cwd: extensionDistDir });
    const buffer = await fs.readFile(tmpZipPath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="toudiya-extension.zip"',
      },
    });
  } catch (error) {
    console.error("[extension] 打包插件失败：", error);
    return NextResponse.json({ error: "打包插件失败，请联系开发者。" }, { status: 500 });
  } finally {
    await fs.unlink(tmpZipPath).catch(() => {});
  }
}

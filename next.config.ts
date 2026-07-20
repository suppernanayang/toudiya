import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 默认 1MB 对简历 PDF/Word 附件太小，调大一些。
      bodySizeLimit: "10mb",
    },
  },
  // pdf-parse 内部依赖 pdfjs-dist 的 worker 脚本，Next.js 打包后会找不到
  // 那个 worker 文件路径（"Setting up fake worker failed"）。把这两个包
  // 标记为服务端外部包，让 Next.js 用 Node 原生 require 加载，不要打包，
  // 这样它们内部的相对路径引用才不会被破坏。
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;

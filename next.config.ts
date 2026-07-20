import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 默认 1MB 对简历 PDF/Word 附件太小，调大一些。
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;

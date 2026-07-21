import { defineManifest } from "@crxjs/vite-plugin";

// Manifest V3。个人开发者模式加载使用，不上架应用商店，所以 host_permissions
// 直接放开到所有网站——JD 识别的"通用兜底"和以后的辅助填表都需要能在任意
// 企业官网上运行，不像应用商店上架的插件那样需要为了审核尽量收窄权限范围。
export default defineManifest({
  manifest_version: 3,
  name: "投递鸭助手",
  description: "一键导入 JD、辅助填表。所有数据只在本机流转，不经过任何第三方服务器。",
  version: "0.1.0",
  action: {
    default_title: "投递鸭助手",
  },
  side_panel: {
    default_path: "src/sidepanel/index.html",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  permissions: ["storage", "sidePanel", "tabs"],
  host_permissions: ["http://localhost:3000/*", "http://*/*", "https://*/*"],
  content_scripts: [
    {
      // 求职鸭自己的页面：自动握手拿配对 token，不需要用户手动做任何事。
      matches: ["http://localhost:3000/*"],
      js: ["src/content/pairing.ts"],
      run_at: "document_idle",
    },
    {
      // 除了求职鸭自己以外的所有网页：脚本会注入但保持"休眠"状态，
      // 只有用户在侧面板点了"识别当前页JD"之后才会真正开始扫描/抓取，
      // 不会自动收集任何页面内容。
      matches: ["http://*/*", "https://*/*"],
      exclude_matches: ["http://localhost:3000/*", "http://localhost/*"],
      js: ["src/content/jd-detect.ts"],
      run_at: "document_idle",
    },
  ],
});

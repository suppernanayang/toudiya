import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  server: {
    port: 5175,
    strictPort: true,
    // Chrome 扩展的 HMR 需要固定端口，跟主项目的 3000 端口区分开。
    hmr: {
      port: 5175,
    },
  },
});

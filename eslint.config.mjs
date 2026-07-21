import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 浏览器插件是独立的子项目（自己的 package.json/tsconfig/依赖），
    // 不属于主项目的 lint 范围，dist 更是构建产物，不该被扫描。
    "extension/**",
    // Prisma 自动生成的 client 代码，不是手写的业务代码。
    "src/generated/**",
  ]),
]);

export default eslintConfig;

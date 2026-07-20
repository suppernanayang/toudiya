import { config } from "dotenv";
import path from "path";

// 独立脚本（用 tsx 直接跑）不会像 next dev / next build 那样自动加载
// .env / .env.local，这里手动补上，跟 Next.js 的加载顺序保持一致：
// 后加载的文件会覆盖先加载文件里的同名变量，所以 .env.local 放后面。
const root = path.join(__dirname, "..");
config({ path: path.join(root, ".env") });
config({ path: path.join(root, ".env.local"), override: true });

import "./load-env";
import { promises as fs } from "fs";
import path from "path";
import { generateResumePdf } from "../src/lib/resume-pdf/generate";

const SAMPLE_CONTENT = `## 教育经历
某大学 · 市场营销专业 · 本科 | 2022.09 - 2026.06
- 主修课程：消费者行为学、市场调研、数据分析基础
- GPA 3.7/4.0，专业排名前 10%

## 实习经历
小红书 · 内容运营实习生 | 2025.03 - 2025.09
- 参与拆解社区热门内容供给结构，整理 120+ 条竞品内容样本，输出选题标签体系
- 协助搭建内容复盘表，按曝光、互动、收藏等维度跟踪内容表现，推动运营从经验判断转向数据复盘
- 待补充：本项目暂无具体互动率提升数据，需用户后续补充确认

## 校园经历
校学生会新媒体中心 · 新媒体运营负责人 | 2023.09 - 2024.06
- 负责账号选题规划和发布节奏维护，结合评论反馈调整内容表达
- 活动报名转化率从 12% 提升至 18%（有后台数据支持）

## 技能
新媒体运营、数据分析基础、Excel、PPT、内容策划`;

async function main() {
  const result = await generateResumePdf({
    name: "张小鸭",
    targetRole: "产品运营方向",
    city: "上海",
    email: "zhangxiaoya@example.com",
    phone: "138****1234",
    contentText: SAMPLE_CONTENT,
  });

  if (!result.ok) {
    console.error("生成失败：", result.reason);
    process.exit(1);
  }

  const outputPath = path.join(__dirname, "sample-resume.pdf");
  await fs.writeFile(outputPath, result.buffer);
  console.log("样例 PDF 已生成：", outputPath);
}

main().catch((error) => {
  console.error("脚本出错：", error);
  process.exit(1);
});

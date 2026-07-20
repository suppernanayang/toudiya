import { Font } from "@react-pdf/renderer";
import path from "path";

let registered = false;

/**
 * 注册中文字体。@react-pdf/renderer 自带的字体是西文字体（Helvetica 等），
 * 不注册中文字体的话，简历里的汉字会变成空白/方块。
 * 用的是思源黑体家族的 Noto Sans SC（SIL 开源字体许可证，可免费商用嵌入）。
 */
export function registerResumeFonts() {
  if (registered) return;
  registered = true;

  const fontsDir = path.join(process.cwd(), "src/assets/fonts");

  Font.register({
    family: "NotoSansSC",
    fonts: [
      { src: path.join(fontsDir, "NotoSansSC-Regular.otf"), fontWeight: "normal" },
      { src: path.join(fontsDir, "NotoSansSC-Bold.otf"), fontWeight: "bold" },
    ],
  });

  // react-pdf 默认会用连字符自动断词，中文不需要这个逻辑，关掉避免断词断错地方。
  Font.registerHyphenationCallback((word) => [word]);
}

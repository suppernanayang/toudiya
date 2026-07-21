import { Font } from "@react-pdf/renderer";
import path from "path";

let registered = false;

/**
 * react-pdf 默认按连字符断词，遇到中文这种"一大段没有空格"的文本时，
 * 会把一整段识别成一个不可拆分的"词"，导致这段文字宽度不够时不会换行，
 * 而是整段溢出到页面边界外面（这是一个真实出现过的 bug，不是假设）。
 *
 * 之前这里写的是 `Font.registerHyphenationCallback((word) => [word])`——
 * 这行代码本身就是 bug 的根源：它把"词"整体标记为不可拆分，对英文场景是对的
 * （避免英文单词从中间断开），但对中文场景恰恰相反，会导致长句子无法换行。
 *
 * 修法参考自开源项目 xitanggg/open-resume 对同一个 react-pdf 已知问题的处理
 * （react-pdf/renderer#1568）：把"词"拆成单个字符，每个字符之间插入一个空字符
 * 作为断行点，这样即使一大段中文没有空格，也能在任意字符之间换行，不会再溢出。
 */
export function registerResumeHyphenationCallback() {
  Font.registerHyphenationCallback((word) => word.split("").flatMap((char) => [char, ""]));
}

/**
 * 注册中文字体（服务端用，导出 PDF 时调用）。@react-pdf/renderer 自带的字体是
 * 西文字体（Helvetica 等），不注册中文字体的话，简历里的汉字会变成空白/方块。
 * 用的是思源黑体家族的 Noto Sans SC（SIL 开源字体许可证，可免费商用嵌入）。
 * 字体文件放在 public/fonts/ 下（而不是之前的 src/assets/fonts），
 * 这样服务端用文件系统路径读取、浏览器端用 URL 请求，可以共用同一份文件。
 *
 * 注意：这个文件依赖 Node 的 path 模块，只能在服务端用；浏览器端预览请用
 * ./fonts-client.ts 里的 registerResumeFontsForBrowser。
 */
export function registerResumeFonts() {
  if (registered) return;
  registered = true;

  const fontsDir = path.join(process.cwd(), "public/fonts");

  Font.register({
    family: "NotoSansSC",
    fonts: [
      { src: path.join(fontsDir, "NotoSansSC-Regular.otf"), fontWeight: "normal" },
      { src: path.join(fontsDir, "NotoSansSC-Bold.otf"), fontWeight: "bold" },
    ],
  });

  registerResumeHyphenationCallback();
}

import { Font } from "@react-pdf/renderer";

// 这个文件专门给浏览器端用（导出前的实时预览），不能 import "path" 之类的 Node
// 内置模块，否则会被打进客户端 bundle 报错。跟服务端版本（./fonts.ts）逻辑完全
// 一致，只是字体文件的 src 换成了浏览器能请求到的 URL，而不是文件系统路径。

let registeredForBrowser = false;

export function registerResumeFontsForBrowser() {
  // 双重保险：如果不小心在服务端渲染阶段被调用到，直接跳过，
  // 避免污染服务端导出 PDF 用的那份"文件路径版"字体注册。
  if (typeof window === "undefined") return;
  if (registeredForBrowser) return;
  registeredForBrowser = true;

  Font.register({
    family: "NotoSansSC",
    fonts: [
      { src: "/fonts/NotoSansSC-Regular.otf", fontWeight: "normal" },
      { src: "/fonts/NotoSansSC-Bold.otf", fontWeight: "bold" },
    ],
  });

  // 换行 bug 的修法跟服务端一样，见 ./fonts.ts 里 registerResumeHyphenationCallback 的注释。
  Font.registerHyphenationCallback((word) => word.split("").flatMap((char) => [char, ""]));
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Tag } from "@/components/ui/Tag";
import { regenerateExtensionToken } from "./actions";

// 跟插件 content script 之间约定的 postMessage 协议。
// 页面负责把 token 广播出去，插件 content script 监听后存进 chrome.storage.local，
// 再回一个 ACK 让页面知道"插件确实收到了、已经连上了"。
const MESSAGE_SOURCE = "toudiya-app";
const MSG_TOKEN = "TOUDIYA_EXTENSION_TOKEN";
const MSG_ACK = "TOUDIYA_EXTENSION_ACK";

type ConnectionStatus = "checking" | "connected" | "not_detected";

function broadcastToken(token: string) {
  window.postMessage({ source: MESSAGE_SOURCE, type: MSG_TOKEN, token }, window.location.origin);
}

export function ExtensionPairingClient({ token, lastSeenAt }: { token: string; lastSeenAt: string | null }) {
  const [status, setStatus] = useState<ConnectionStatus>("checking");
  const [currentToken, setCurrentToken] = useState(token);
  const [isPending, startTransition] = useTransition();
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.source !== MESSAGE_SOURCE) return;
      if (event.data?.type === MSG_ACK) {
        setStatus("connected");
      }
    }

    window.addEventListener("message", handleMessage);
    broadcastToken(currentToken);

    // 广播完等 2 秒看插件有没有回 ACK，没回就认为还没装插件（或者插件还没打开这个页面过）。
    const timer = setTimeout(() => {
      setStatus((prev) => (prev === "connected" ? prev : "not_detected"));
    }, 2000);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(timer);
    };
  }, [currentToken]);

  const handleRegenerate = () => {
    setStatus("checking");
    startTransition(async () => {
      const result = await regenerateExtensionToken();
      setCurrentToken(result.token);
    });
  };

  return (
    <>
      <Panel>
        <PanelHeader
          title="连接状态"
          subtitle="插件安装好之后打开这个页面，会自动完成配对，不需要手动输入任何东西"
        />
        <div className="p-4 grid gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted">当前状态：</span>
            {status === "checking" ? <Tag variant="default">检测中…</Tag> : null}
            {status === "connected" ? <Tag variant="green">插件已连接</Tag> : null}
            {status === "not_detected" ? <Tag variant="amber">未检测到插件</Tag> : null}
          </div>
          {lastSeenAt ? (
            <div className="text-muted text-xs">最近一次收到插件请求：{new Date(lastSeenAt).toLocaleString()}</div>
          ) : null}
          {status === "not_detected" ? (
            <div className="text-muted text-xs leading-relaxed">
              还没检测到插件——要么还没安装，要么装好了但还没打开过这个页面。安装完插件后，刷新一下这个页面就会自动配对。
            </div>
          ) : null}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="text-teal-dark text-xs whitespace-nowrap"
            >
              {showToken ? "隐藏配对码" : "查看配对码"}
            </button>
            {showToken ? (
              <div className="mt-2 rounded-lg border border-line bg-[#fbfcfc] p-3 font-mono text-xs break-all">
                {currentToken}
              </div>
            ) : null}
          </div>
          <div className="pt-1">
            <button
              type="button"
              disabled={isPending}
              onClick={handleRegenerate}
              className="min-h-8 rounded-lg border border-line px-3 text-xs disabled:opacity-60"
            >
              {isPending ? "生成中…" : "重新生成配对码（会让当前插件断开，需要重新打开这个页面）"}
            </button>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="安装说明" subtitle="开发者模式加载，个人使用，不需要上架应用商店" />
        <div className="p-4 grid gap-2 text-sm leading-relaxed text-muted">
          <p className="m-0">插件还在开发中，装好之后这里会更新成具体的下载入口和安装步骤。大致流程会是：</p>
          <ol className="m-0 pl-5 grid gap-1 list-decimal">
            <li>下载插件文件（解压后的文件夹）</li>
            <li>浏览器地址栏打开 chrome://extensions</li>
            <li>打开右上角&ldquo;开发者模式&rdquo;</li>
            <li>点&ldquo;加载已解压的扩展程序&rdquo;，选中插件文件夹</li>
            <li>回到这个页面刷新一下，看到&ldquo;插件已连接&rdquo;就说明装好了</li>
          </ol>
        </div>
      </Panel>
    </>
  );
}

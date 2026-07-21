import { PageShell } from "@/components/layout/PageShell";
import { getOrCreateExtensionToken } from "./actions";
import { ExtensionPairingClient } from "./ExtensionPairingClient";

export default async function ExtensionPage() {
  const pairing = await getOrCreateExtensionToken();

  return (
    <PageShell title="浏览器插件" subtitle="一键导入 JD、辅助填表——所有数据只在你本机流转，不经过任何第三方服务器">
      <ExtensionPairingClient token={pairing.token} lastSeenAt={pairing.lastSeenAt} />
    </PageShell>
  );
}

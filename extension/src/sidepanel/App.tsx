import { useEffect, useState } from "react";
import type { ExtensionMessage, ExtensionResponse, JdExtractionResult } from "../lib/messages";

type PairingState = "checking" | "connected" | "not_connected";
type ExtractState = "idle" | "extracting" | "ready" | "error";
type ImportState = "idle" | "importing" | "success" | "error";

async function sendMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  return (await chrome.runtime.sendMessage(message)) as ExtensionResponse;
}

export function App() {
  const [pairing, setPairing] = useState<PairingState>("checking");
  const [extractState, setExtractState] = useState<ExtractState>("idle");
  const [extractError, setExtractError] = useState("");
  const [form, setForm] = useState({ company: "", title: "", jdText: "" });
  const [extractionMeta, setExtractionMeta] = useState<Pick<JdExtractionResult, "source" | "confidence"> | null>(
    null,
  );
  const [debugText, setDebugText] = useState("");
  const [showDebugText, setShowDebugText] = useState(false);
  const [importState, setImportState] = useState<ImportState>("idle");
  const [importMessage, setImportMessage] = useState("");

  useEffect(() => {
    sendMessage({ type: "GET_PAIRING_STATUS" }).then((res) => {
      if (res.ok && "status" in res) {
        setPairing(res.status === "connected" ? "connected" : "not_connected");
      }
    });
  }, []);

  const handleExtract = async () => {
    setExtractState("extracting");
    setExtractError("");
    setImportState("idle");
    setDebugText("");
    try {
      const res = await sendMessage({ type: "EXTRACT_JD_ON_ACTIVE_TAB" });
      if (!res.ok) {
        setExtractState("error");
        setExtractError(res.message);
        return;
      }
      if (!("result" in res)) {
        setExtractState("error");
        setExtractError("识别结果格式不对。");
        return;
      }
      setForm({ company: res.result.company, title: res.result.title, jdText: res.result.jdText });
      setExtractionMeta({ source: res.result.source, confidence: res.result.confidence });
      setDebugText(res.result.debugText || "");
      setExtractState("ready");
    } catch (error) {
      setExtractState("error");
      setExtractError(error instanceof Error ? error.message : "识别失败");
    }
  };

  const handleImport = async () => {
    if (!form.company.trim() || !form.title.trim()) {
      setImportState("error");
      setImportMessage("公司和岗位名称不能为空，检查一下上面的内容。");
      return;
    }
    setImportState("importing");
    setImportMessage("");
    try {
      const res = await sendMessage({
        type: "CREATE_JOB",
        payload: { company: form.company.trim(), title: form.title.trim(), jdText: form.jdText.trim() },
      });
      if (!res.ok) {
        setImportState("error");
        setImportMessage(res.message);
        return;
      }
      setImportState("success");
      setImportMessage(
        "analysisOk" in res && res.analysisOk
          ? "已导入求职鸭岗位池，AI 分析也完成了。"
          : "已导入求职鸭岗位池（AI 分析可能失败或跳过，去岗位池里看看）。",
      );
    } catch (error) {
      setImportState("error");
      setImportMessage(error instanceof Error ? error.message : "导入失败");
    }
  };

  if (pairing !== "connected") {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>投递鸭助手</h2>
        <p style={{ color: "var(--color-muted)" }}>
          还没有跟求职鸭配对{pairing === "checking" ? "，检测中…" : "。"}
        </p>
        {pairing === "not_connected" ? (
          <p style={{ color: "var(--color-muted)" }}>
            打开求职鸭网页里的「浏览器插件」设置页（http://localhost:3000/extension），会自动完成配对。
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: 15 }}>一键导入 JD</h2>
        <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 12 }}>
          在招聘详情页点下面的按钮，识别到内容后可以先改一改再导入。
        </p>
      </div>

      <button
        type="button"
        disabled={extractState === "extracting"}
        onClick={handleExtract}
        style={{
          minHeight: 32,
          borderRadius: 8,
          border: "1px solid var(--color-teal)",
          background: "var(--color-teal)",
          color: "#fff",
        }}
      >
        {extractState === "extracting" ? "识别中…" : "识别当前页面的 JD"}
      </button>

      {extractState === "error" ? (
        <p style={{ color: "var(--color-rose)", fontSize: 12 }}>{extractError}</p>
      ) : null}

      {extractState === "ready" ? (
        <div style={{ display: "grid", gap: 10, border: "1px solid var(--color-line)", borderRadius: 8, padding: 10 }}>
          {extractionMeta ? (
            <p style={{ margin: 0, fontSize: 11, color: "var(--color-muted)" }}>
              识别方式：{extractionMeta.source === "selector" ? "平台精确规则" : "AI 通用识别"}
              {extractionMeta.source === "ai" ? `（把握程度：${confidenceLabel(extractionMeta.confidence)}）` : ""}
              —— 如果不准，直接改下面的内容就行。
            </p>
          ) : null}

          {debugText ? (
            <div>
              <button
                type="button"
                onClick={() => setShowDebugText((v) => !v)}
                style={{ fontSize: 11, color: "var(--color-teal-dark)", background: "none", border: "none", padding: 0 }}
              >
                {showDebugText ? "隐藏" : "查看"}实际抓到的原始文本（识别不准时可以看看是不是抓错内容了）
              </button>
              {showDebugText ? (
                <pre
                  style={{
                    marginTop: 6,
                    padding: 8,
                    background: "#fbfcfc",
                    border: "1px solid var(--color-line)",
                    borderRadius: 6,
                    fontSize: 11,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    maxHeight: 160,
                    overflow: "auto",
                  }}
                >
                  {debugText}
                </pre>
              ) : null}
            </div>
          ) : null}

          <Field label="公司">
            <input
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              style={inputStyle}
            />
          </Field>
          <Field label="岗位名称">
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              style={inputStyle}
            />
          </Field>
          <Field label="JD 正文">
            <textarea
              value={form.jdText}
              onChange={(e) => setForm((f) => ({ ...f, jdText: e.target.value }))}
              rows={10}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>

          <button
            type="button"
            disabled={importState === "importing"}
            onClick={handleImport}
            style={{
              minHeight: 32,
              borderRadius: 8,
              border: "1px solid var(--color-line)",
              background: "var(--color-surface)",
            }}
          >
            {importState === "importing" ? "导入中…" : "确认导入求职鸭"}
          </button>

          {importState === "success" ? (
            <p style={{ color: "var(--color-green)", fontSize: 12 }}>{importMessage}</p>
          ) : null}
          {importState === "error" ? <p style={{ color: "var(--color-rose)", fontSize: 12 }}>{importMessage}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function confidenceLabel(confidence: JdExtractionResult["confidence"]): string {
  return { high: "高", medium: "中", low: "低" }[confidence];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--color-line)",
  background: "#fff",
  color: "var(--color-text)",
};

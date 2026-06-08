"use client";

import { useState, useEffect, useRef } from "react";
import ChatPanel from "@/components/ChatPanel";
import type { Source } from "@/components/ChatPanel";
import DocumentViewer from "@/components/DocumentViewer";
import ThemeToggle from "@/components/ThemeToggle";
import LlmConfigPanel from "@/components/LlmConfigPanel";
import { useLlmConfig } from "@/hooks/useLlmConfig";

/** 上传面板 — 无文档时显示在左侧文档区 */
function DocUploadPanel({
  onUpload,
  onUploadStart,
}: {
  onUpload: (docId: string, name: string) => void;
  onUploadStart?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const ALLOWED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  function isAllowedFile(file: File): boolean {
    if (ALLOWED_TYPES.includes(file.type)) return true;
    const name = file.name.toLowerCase();
    return name.endsWith(".pdf") || name.endsWith(".docx");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAllowedFile(file)) {
      setError("仅支持 PDF 和 DOCX 文件");
      return;
    }
    if (file.size > 4.5 * 1024 * 1024) {
      setError("文件不能超过 4.5MB");
      return;
    }

    onUploadStart?.();
    setUploading(true);
    setError("");

    const fd = new FormData();
    fd.append("file", file);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
        signal: controller.signal,
      });
      const data = (await res.json()) as {
        documentId?: string;
        name?: string;
        error?: string;
        embedding?: { total: number; success: number };
      };

      if (!res.ok) {
        if (res.status === 413) setError("文件大小不能超过 10MB");
        else if (res.status === 429) setError("请求过于频繁，请稍后重试");
        else setError(data.error || "上传失败");
        return;
      }

      if (!data.documentId) {
        setError("上传失败：服务器未返回文档 ID");
        return;
      }

      if (
        (data.embedding?.total ?? 0) > 0 &&
        (data.embedding?.success ?? 0) === 0
      ) {
        setError("文档上传成功，但向量化失败，请检查 SILICONFLOW_API_KEY");
        return;
      }

      onUpload(data.documentId, data.name || file.name);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("上传超时，请检查网络或稍后重试");
      } else {
        setError("网络错误，请重试");
      }
    } finally {
      clearTimeout(timeoutId);
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0 rounded-xl"
      style={{ border: '1px dashed var(--color-border)', background: 'var(--color-bg-raised)' }}>
      <div className="text-center px-6 py-12">
        <div className="text-5xl mb-5 opacity-15">◈</div>
        <p className="text-sm mb-5 opacity-40" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          上传一份 PDF 或 DOCX 文档
        </p>
        <label
          className="relative inline-flex px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
          style={{
            background: uploading ? 'var(--color-bg-surface)' : 'var(--color-accent)',
            color: uploading ? 'var(--color-text-muted)' : 'var(--color-accent-fg)',
            fontFamily: 'DM Sans, sans-serif',
            opacity: uploading ? 0.6 : 1,
            cursor: uploading ? 'not-allowed' : 'pointer',
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFile}
            disabled={uploading}
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
          <span className="pointer-events-none select-none">
            {uploading ? "上传并向量化中…" : "选择文档"}
          </span>
        </label>
        {error && <p className="text-xs mt-3" style={{ color: 'var(--color-red)' }}>{error}</p>}
      </div>
    </div>
  );
}

export default function Home() {
  const {
    loading: llmConfigLoading,
    serverConfigured,
    llmReady,
    showConfigPanel,
    llmCredentials,
    saveCredentials,
    openConfigPanel,
  } = useLlmConfig();

  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [activeChunkId, setActiveChunkId] = useState<string | null>(null);
  const [embedReady, setEmbedReady] = useState(false);
  const [embedStatus, setEmbedStatus] = useState<"idle" | "loading" | "error">("idle");
  const [mobileTab, setMobileTab] = useState<"doc" | "chat">("doc");
  /** 用户已手动上传/替换文档后，忽略启动时的自动加载结果 */
  const skipAutoLoadRef = useRef(false);

  // 后台加载最近文档，不阻塞整页渲染
  // 从 localStorage 恢复上次上传的文档（多用户互不干扰）
  useEffect(() => {
    if (skipAutoLoadRef.current) return;
    try {
      const savedId = localStorage.getItem("citedoc-doc-id");
      const savedName = localStorage.getItem("citedoc-doc-name");
      if (savedId) {
        setDocumentId(savedId);
        setDocumentName(savedName || null);
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 确保文档已完成向量化（修复历史上传未 embedding 的情况）
  useEffect(() => {
    if (!documentId) {
      setEmbedReady(false);
      setEmbedStatus("idle");
      return;
    }

    let cancelled = false;

    async function ensureEmbeddings() {
      setEmbedStatus("loading");
      setEmbedReady(false);

      try {
        const progRes = await fetch(`/api/documents/${documentId}/embed`);
        const prog = await progRes.json();
        if (cancelled) return;

        if (!progRes.ok || prog.total === 0) {
          setEmbedStatus("error");
          return;
        }

        if (prog.embedded >= prog.total) {
          setEmbedReady(true);
          setEmbedStatus("idle");
          return;
        }

        const embedRes = await fetch(`/api/documents/${documentId}/embed`, {
          method: "POST",
        });
        const result = await embedRes.json();
        if (cancelled) return;

        if (!embedRes.ok || result.success === 0) {
          setEmbedStatus("error");
          return;
        }

        setEmbedReady(true);
        setEmbedStatus("idle");
      } catch {
        if (!cancelled) setEmbedStatus("error");
      }
    }

    ensureEmbeddings();
    return () => { cancelled = true; };
  }, [documentId]);

  function markUserDocumentAction() {
    skipAutoLoadRef.current = true;
  }

  function handleUploadSuccess(docId: string, name: string) {
    skipAutoLoadRef.current = true;
    setDocumentId(docId);
    setDocumentName(name);
    setActiveChunkId(null);
    try { localStorage.setItem("citedoc-doc-id", docId); localStorage.setItem("citedoc-doc-name", name); } catch {}
    setMobileTab("chat");
  }

  function handleSourceClick(source: Source) {
    setActiveChunkId(source.chunkId);
    // 移动端：点击角标时自动切换到原文 Tab
    if (window.innerWidth < 768) setMobileTab("doc");
  }

  // 无文档时默认显示「原文」Tab，避免移动端找不到上传入口
  useEffect(() => {
    if (!documentId) setMobileTab("doc");
  }, [documentId]);

  // 高亮 3 秒后自动淡出
  useEffect(() => {
    if (!activeChunkId) return;
    const timer = setTimeout(() => setActiveChunkId(null), 3000);
    return () => clearTimeout(timer);
  }, [activeChunkId]);

  return (
    <main
      className="flex flex-col mx-auto h-screen overflow-hidden"
      style={{ maxWidth: 1400, padding: '16px 24px', fontFamily: 'DM Sans, sans-serif' }}
    >
      {/* ---- Header ---- */}
      <header className="flex items-center justify-between shrink-0 pb-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg sm:text-xl tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
            Cite<span style={{ color: 'var(--color-accent)' }}>Doc</span>
          </h1>
          <span className="text-xs opacity-30 hidden sm:inline" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            问文档，答有据
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* ---- Body ---- */}
      <div className="flex-1 min-h-0 mt-3">
        <div className="flex flex-col lg:flex-row gap-4 h-full animate-fade-in-up">
            {/* 移动端 Tab */}
            <div className="flex lg:hidden gap-1 p-1 rounded-xl shrink-0" style={{ background: 'var(--color-bg-surface)' }}>
              <button onClick={() => setMobileTab("chat")} className="flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200"
                style={mobileTab === "chat" ? { background: 'var(--color-accent)', color: 'var(--color-accent-fg)' } : { color: 'var(--color-text-muted)' }}>
                问答
              </button>
              <button onClick={() => setMobileTab("doc")} className="flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200"
                style={mobileTab === "doc" ? { background: 'var(--color-accent)', color: 'var(--color-accent-fg)' } : { color: 'var(--color-text-muted)' }}>
                原文
              </button>
            </div>

            {/* 左侧：文档面板 = 上传入口 + 文档原文 + 文档操作 */}
            <div className={`lg:w-[42%] lg:shrink-0 min-h-0 ${mobileTab !== "doc" ? "hidden lg:flex" : "flex"}`}>
              {documentId ? (
                <DocumentViewer
                  documentId={documentId}
                  documentName={documentName}
                  activeChunkId={activeChunkId}
                  onReplace={() => {
                    markUserDocumentAction();
                    setDocumentId(null);
                    setDocumentName(null);
                    setMobileTab("doc");
                  }}
                />
              ) : (
                <DocUploadPanel
                  onUpload={handleUploadSuccess}
                  onUploadStart={markUserDocumentAction}
                />
              )}
            </div>

            {/* Divider */}
            <div className="hidden lg:block w-px shrink-0" style={{ background: 'var(--color-border)' }} />

            {/* 右侧：AI 问答 — 优先级：LLM 配置检查 > LLM 配置面板 > 等待文档 > 问答 */}
            <div className={`flex-1 min-h-0 ${mobileTab !== "chat" ? "hidden lg:flex" : "flex"}`}>
              {llmConfigLoading ? (
                <div className="flex-1 flex items-center justify-center" style={{ color: "var(--color-text-muted)" }}>
                  <p className="text-sm opacity-30">检查 LLM 配置…</p>
                </div>
              ) : !llmReady || showConfigPanel ? (
                <LlmConfigPanel onSave={saveCredentials} initialCredentials={llmCredentials} />
              ) : documentId ? (
                <ChatPanel
                  documentId={documentId}
                  onSourceClick={handleSourceClick}
                  disabled={!embedReady || embedStatus === "loading"}
                  disabledReason={
                    embedStatus === "loading"
                      ? "文档向量化中，请稍候…"
                      : embedStatus === "error"
                        ? "向量化失败，请检查 Vercel 中的 SILICONFLOW_API_KEY"
                        : !embedReady
                          ? "文档尚未完成向量化"
                          : undefined
                  }
                  llmCredentials={llmCredentials}
                  showEditLlmConfig={!serverConfigured && !!llmCredentials}
                  onEditLlmConfig={openConfigPanel}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: 'var(--color-text-muted)' }}>
                  <p className="text-sm opacity-30">LLM 已就绪，上传文档后开始问答</p>
                  {!serverConfigured && !!llmCredentials && (
                    <button
                      type="button"
                      onClick={openConfigPanel}
                      className="text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
                      style={{
                        fontFamily: "DM Sans, sans-serif",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      修改 LLM 配置
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
      </div>
    </main>
  );
}

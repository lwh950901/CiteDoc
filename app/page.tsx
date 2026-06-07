"use client";

import { useState, useEffect, useRef } from "react";
import ChatPanel from "@/components/ChatPanel";
import type { Source } from "@/components/ChatPanel";
import DocumentViewer from "@/components/DocumentViewer";
import ThemeToggle from "@/components/ThemeToggle";

/** 上传面板 — 无文档时显示在左侧文档区 */
function DocUploadPanel({ onUpload }: { onUpload: (docId: string, name: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const ALLOWED = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  async function handleFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (!ALLOWED.includes(file.type)) { setError("仅支持 PDF 和 DOCX 文件"); return; }
    if (file.size > 10 * 1024 * 1024) { setError("文件不能超过 10MB"); return; }
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 413) setError("文件大小不能超过 10MB");
        else if (res.status === 429) setError("请求过于频繁，请稍后重试");
        else setError(data.error || "上传失败");
        setUploading(false);
        return;
      }
      onUpload(data.documentId, data.name);
    } catch {
      setError("网络错误，请重试");
      setUploading(false);
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
        <input ref={fileRef} type="file" accept=".pdf,.docx" onChange={handleFile} className="sr-only" id="doc-upload" />
        <label
          htmlFor="doc-upload"
          className="inline-flex px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
          style={{
            background: uploading ? 'var(--color-bg-surface)' : 'var(--color-accent)',
            color: uploading ? 'var(--color-text-muted)' : 'var(--color-accent-fg)',
            fontFamily: 'DM Sans, sans-serif',
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? "上传中…" : "选择文档"}
        </label>
        {error && <p className="text-xs mt-3" style={{ color: 'var(--color-red)' }}>{error}</p>}
      </div>
    </div>
  );
}

export default function Home() {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [activeChunkId, setActiveChunkId] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(true);

  // 页面加载时自动获取最近上传的文档
  useEffect(() => {
    let cancelled = false;
    fetch("/api/documents")
      .then((res) => res.json())
      .then((data: { documentId: string | null; name?: string }) => {
        if (!cancelled && data.documentId) {
          setDocumentId(data.documentId);
          if (data.name) setDocumentName(data.name);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDocLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function handleUploadSuccess(docId: string, name: string) {
    setDocumentId(docId);
    setDocumentName(name);
    setActiveChunkId(null);
  }

  const [mobileTab, setMobileTab] = useState<"doc" | "chat">("chat");

  function handleSourceClick(source: Source) {
    setActiveChunkId(source.chunkId);
    // 移动端：点击角标时自动切换到原文 Tab
    if (window.innerWidth < 768) setMobileTab("doc");
  }

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
        <ThemeToggle />
      </header>

      {/* ---- Body ---- */}
      <div className="flex-1 min-h-0 mt-3">
        {/* Loading */}
        {docLoading && (
          <div className="flex items-center justify-center h-full gap-3 animate-breathe" style={{ color: 'var(--color-text-muted)' }}>
            <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)' }} />
            <span className="text-sm">加载文档中…</span>
          </div>
        )}

        {!docLoading && (
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
                  onReplace={() => { setDocumentId(null); setDocumentName(null); }}
                />
              ) : (
                <DocUploadPanel onUpload={handleUploadSuccess} />
              )}
            </div>

            {/* Divider */}
            <div className="hidden lg:block w-px shrink-0" style={{ background: 'var(--color-border)' }} />

            {/* 右侧：AI 问答 */}
            <div className={`flex-1 min-h-0 ${mobileTab !== "chat" ? "hidden lg:flex" : "flex"}`}>
              {documentId ? (
                <ChatPanel
                  documentId={documentId}
                  onSourceClick={handleSourceClick}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
                  <p className="text-sm opacity-30">上传文档后开始问答</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

"use client";

import { useState, useEffect } from "react";
import FileUpload from "@/components/FileUpload";
import ChatPanel from "@/components/ChatPanel";
import type { Source } from "@/components/ChatPanel";
import DocumentViewer from "@/components/DocumentViewer";

export default function Home() {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [activeChunkId, setActiveChunkId] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(true);

  // 页面加载时自动获取最近上传的文档
  useEffect(() => {
    let cancelled = false;
    fetch("/api/documents")
      .then((res) => res.json())
      .then((data: { documentId: string | null }) => {
        if (!cancelled && data.documentId) {
          setDocumentId(data.documentId);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDocLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function handleUploadSuccess(docId: string) {
    setDocumentId(docId);
    setActiveChunkId(null);
  }

  function handleSourceClick(source: Source) {
    setActiveChunkId(source.chunkId);
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 lg:p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">DocQATracer</h1>
      <p className="text-gray-500 mb-6">文档问答溯源工具</p>

      {/* ---- 文档上传区域 ---- */}
      <section className="w-full mb-6 p-4 lg:p-6 border border-dashed border-gray-300 rounded-xl bg-gray-50">
        <h2 className="text-lg font-semibold mb-4">📄 上传文档</h2>
        <FileUpload onUploadSuccess={handleUploadSuccess} />
      </section>

      {/* ---- 双栏区域：文档原文 + AI 问答 ---- */}
      {documentId && (
        <section className="w-full flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0">
          {/* 左侧：文档原文 */}
          <div className="w-full lg:w-[45%] lg:shrink-0">
            <h2 className="text-lg font-semibold mb-3">📖 文档原文</h2>
            <DocumentViewer
              documentId={documentId}
              activeChunkId={activeChunkId}
            />
          </div>

          {/* 右侧：AI 问答 */}
          <div className="w-full lg:flex-1">
            <h2 className="text-lg font-semibold mb-3">🤖 文档问答</h2>
            <ChatPanel
              documentId={documentId}
              onSourceClick={handleSourceClick}
            />
          </div>
        </section>
      )}

      {/* 未上传文档时的提示 */}
      {!documentId && !docLoading && (
        <div className="text-center text-gray-400 py-12 border border-dashed border-gray-300 rounded-lg w-full">
          请先上传一个 PDF 或 DOCX 文档
        </div>
      )}
      {!documentId && docLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-12 justify-center w-full">
          <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          加载文档中...
        </div>
      )}
    </main>
  );
}

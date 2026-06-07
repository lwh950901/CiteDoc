"use client";

import { useEffect, useState, useRef, useMemo } from "react";

// ---- Types ----

interface ChunkMeta {
  id: string;
  content: string;
  metadata: {
    page: number;
    charStart: number;
    charEnd: number;
    [key: string]: unknown;
  } | null;
}

interface DocInfo {
  id: string;
  name: string;
  content: string;
}

interface DocumentViewerProps {
  documentId: string;
  activeChunkId: string | null;
}

// ---- Component ----

export default function DocumentViewer({
  documentId,
  activeChunkId,
}: DocumentViewerProps) {
  const [fullText, setFullText] = useState("");
  const [chunks, setChunks] = useState<ChunkMeta[]>([]);
  const [docName, setDocName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // ---- 加载文档和 chunks ----

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [docRes, chunksRes] = await Promise.all([
          fetch(`/api/documents/${documentId}`),
          fetch(`/api/documents/${documentId}/chunks`),
        ]);

        if (cancelled) return;

        if (!docRes.ok) {
          setError("无法加载文档");
          setLoading(false);
          return;
        }

        const doc: DocInfo = await docRes.json();
        setFullText(doc.content);
        setDocName(doc.name);

        if (chunksRes.ok) {
          const chunkData: ChunkMeta[] = await chunksRes.json();
          setChunks(chunkData);
        } else {
          console.error("Failed to load chunks:", chunksRes.status);
        }
      } catch {
        if (!cancelled) {
          setError("网络错误");
        }
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  // ---- 高亮 + 滚动 ----

  const prevChunkIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeChunkId || loading) return;

    // 移除旧高亮（CSS 动画类）
    if (prevChunkIdRef.current) {
      const oldEl = document.getElementById(
        `chunk-${prevChunkIdRef.current}`
      );
      oldEl?.classList.remove("chunk-highlight");
    }

    // 添加新高亮（CSS 动画，2s 自动淡出）
    const el = document.getElementById(`chunk-${activeChunkId}`);
    if (el) {
      // 移除再添加以触发动画重播
      el.classList.remove("chunk-highlight");
      void el.offsetWidth; // 强制回流以重启动画
      el.classList.add("chunk-highlight");
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    prevChunkIdRef.current = activeChunkId;
  }, [activeChunkId, loading]);

  // ---- 按 chunks 切分渲染 ----

  // 缓存排序后的 chunks，避免每次 render 都重新复制+排序
  const sortedChunks = useMemo(
    () =>
      [...chunks].sort(
        (a, b) =>
          (a.metadata?.charStart ?? 0) - (b.metadata?.charStart ?? 0)
      ),
    [chunks]
  );

  function renderTextWithChunks(): React.ReactNode {
    if (!fullText) return null;

    // 如果没有 chunks 数据，直接渲染全文
    if (sortedChunks.length === 0) {
      return <div className="whitespace-pre-wrap text-sm">{fullText}</div>;
    }

    const spans: React.ReactNode[] = [];
    let pos = 0;
    let prevPage: number | null = null;

    for (const chunk of sortedChunks) {
      const start = chunk.metadata?.charStart ?? 0;
      const end = chunk.metadata?.charEnd ?? 0;
      const page = chunk.metadata?.page;

      // 页面变化时插入分隔标记
      if (page != null && prevPage != null && page !== prevPage) {
        spans.push(
          <div
            key={`page-sep-${page}`}
            className="text-xs text-gray-300 text-center my-4 select-none"
            aria-hidden
          >
            —— 第 {page} 页 ——
          </div>
        );
      }
      if (page != null) prevPage = page;

      // chunks 间可能有间隙（或 charStart > pos），渲染中间文本
      if (start > pos) {
        spans.push(
          <span key={`gap-${pos}`}>
            {fullText.slice(pos, start)}
          </span>
        );
      }

      // 渲染 chunk span
      if (end > start) {
        spans.push(
          <span
            key={`chunk-${chunk.id}`}
            id={`chunk-${chunk.id}`}
            className="transition-colors duration-300 rounded"
          >
            {fullText.slice(start, end)}
          </span>
        );
      }

      pos = Math.max(pos, end);
    }

    // 渲染剩余文本
    if (pos < fullText.length) {
      spans.push(
        <span key={`gap-${pos}`}>{fullText.slice(pos)}</span>
      );
    }

    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {spans}
      </div>
    );
  }

  // ---- 渲染 ----

  return (
    <div className="h-full flex flex-col">
      {/* 文档标题 */}
      {docName && (
        <div className="text-xs text-gray-400 mb-2 truncate px-1">
          📄 {docName}
        </div>
      )}

      {/* 原文容器 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 border border-gray-200 rounded-lg bg-white text-gray-800"
        style={{ maxHeight: "70vh" }}
      >
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
            <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            加载文档中...
          </div>
        )}

        {error && (
          <div className="text-sm text-red-500 py-4">{error}</div>
        )}

        {!loading && !error && renderTextWithChunks()}
      </div>
    </div>
  );
}

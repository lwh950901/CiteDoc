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
  documentName?: string | null;
  activeChunkId: string | null;
  onReplace?: () => void;
}

// ---- Component ----

export default function DocumentViewer({
  documentId,
  documentName,
  activeChunkId,
  onReplace,
}: DocumentViewerProps) {
  const [fullText, setFullText] = useState("");
  const [chunks, setChunks] = useState<ChunkMeta[]>([]);
  const [docName, setDocName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [truncated, setTruncated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 原文超长截断阈值（500KB）
  const MAX_TEXT_LENGTH = 500_000;

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
        const text = doc.content;
        if (text.length > MAX_TEXT_LENGTH) {
          setFullText(text.slice(0, MAX_TEXT_LENGTH));
          setTruncated(true);
        } else {
          setFullText(text);
          setTruncated(false);
        }
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
    <div className="flex flex-col min-h-0 w-full">
      {/* 文档标题 + 操作 */}
      {(docName || documentName) && (
        <div className="flex items-center gap-2 mb-1.5 shrink-0">
          <span className="text-xs font-medium truncate flex-1 min-w-0" style={{fontFamily: 'DM Sans, sans-serif', color: 'var(--color-text-primary)'}}>
            {docName || documentName}
          </span>
          {onReplace && (
            <button
              onClick={onReplace}
              className="text-xs px-2.5 py-1 rounded-md shrink-0 transition-all duration-200"
              style={{
                background: 'var(--color-bg-surface)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              换文件
            </button>
          )}
        </div>
      )}

      {/* 原文容器 — 撑满剩余高度 */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-5 rounded-xl shadow-lg"
        style={{
          background: 'var(--color-doc-bg)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-doc-text)',
          fontFamily: 'Crimson Pro, Georgia, serif',
          fontSize: '16px',
          lineHeight: '1.8',
        }}
      >
        {loading && (
          <div className="flex items-center gap-2 py-4 animate-breathe" style={{color: 'var(--color-text-muted)'}}>
            <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)'}} />
            加载文档中…
          </div>
        )}

        {error && (
          <div className="text-sm py-4" style={{color: 'var(--color-red)'}}>{error}</div>
        )}

        {truncated && (
          <div className="text-xs rounded-lg p-3 mb-4" style={{background: 'rgba(212,160,49,0.08)', border: '1px solid rgba(212,160,49,0.2)', color: 'var(--color-accent)'}}>
            文档过长，仅显示前 500KB。完整内容请查看原始文件。
          </div>
        )}

        {/* 段落分隔符暗色 */}
        <style>{`
          .document-viewer [class*="page-sep"] {
            color: var(--color-text-muted) !important;
            border-color: var(--color-border) !important;
          }
        `}</style>

        {!loading && !error && renderTextWithChunks()}
      </div>
    </div>
  );
}

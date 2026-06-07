"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { Source } from "@/lib/types";

// ---- Types ----

export type { Source };

interface ChatPanelProps {
  documentId: string;
  onSourceClick: (source: Source) => void;
}

type PanelState = "idle" | "loading" | "done" | "error";

// ---- Component ----

export default function ChatPanel({ documentId, onSourceClick }: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<PanelState>("idle");
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 打字机效果：buffer + 定时器逐字渲染
  const typewriterBufferRef = useRef<string[]>([]);
  const typewriterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamDoneRef = useRef(false);

  function ensureTypewriter() {
    if (typewriterTimerRef.current) return;
    typewriterTimerRef.current = setInterval(() => {
      // 每次取 2 个字符，~30ms/次 ≈ ~60 字/秒
      const batch = typewriterBufferRef.current.splice(0, 2);
      if (batch.length > 0) {
        setAnswer((prev) => prev + batch.join(""));
      }
      // buffer 暂时空了
      if (typewriterBufferRef.current.length === 0) {
        clearInterval(typewriterTimerRef.current!);
        typewriterTimerRef.current = null;
        // stream 已结束 → 全文输出完毕，标记 done
        if (streamDoneRef.current) {
          setState("done");
        }
      }
    }, 30);
  }

  function flushTypewriter() {
    if (typewriterTimerRef.current) {
      clearInterval(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
    if (typewriterBufferRef.current.length > 0) {
      setAnswer((prev) => prev + typewriterBufferRef.current.join(""));
      typewriterBufferRef.current = [];
    }
  }

  // 组件卸载时清理 timer
  useEffect(() => {
    return () => {
      if (typewriterTimerRef.current) {
        clearInterval(typewriterTimerRef.current);
      }
    };
  }, []);

  // ---- SSE 流解析 ----

  const handleAsk = useCallback(async () => {
    const q = question.trim();
    if (!q) return;

    // 中断旧请求
    abortRef.current?.abort();

    // 清理旧打字机状态
    flushTypewriter();
    typewriterBufferRef.current = [];
    streamDoneRef.current = false;

    const controller = new AbortController();
    abortRef.current = controller;

    // 30 秒超时，防止 LLM 无响应时永久等待
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    setState("loading");
    setError("");
    setAnswer("");
    setSources([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, question: q }),
        signal: controller.signal,
      });

      if (!res.ok) {
        clearTimeout(timeoutId);
        setError(`请求失败 (${res.status})`);
        setState("error");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        clearTimeout(timeoutId);
        setError("无法读取响应流");
        setState("error");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 按双换行分割 SSE 事件
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim()) continue;

          const eventMatch = part.match(/^event: (.+)$/m);
          const dataMatch = part.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const eventType = eventMatch[1].trim();
          const rawData = dataMatch[1].trim();

          switch (eventType) {
            case "sources": {
              const parsed = JSON.parse(rawData) as Source[];
              setSources(parsed);
              break;
            }
            case "text": {
              const char = JSON.parse(rawData) as string;
              // 放入打字机 buffer，由定时器逐字渲染
              typewriterBufferRef.current.push(char);
              ensureTypewriter();
              break;
            }
            case "done":
              clearTimeout(timeoutId);
              // 标记 stream 结束，让 typewriter timer 继续逐字输出
              streamDoneRef.current = true;
              // 如果 timer 已停（buffer 已空），直接标记完成
              if (!typewriterTimerRef.current) {
                setState("done");
              }
              return;
            case "error":
              clearTimeout(timeoutId);
              streamDoneRef.current = true;
              flushTypewriter();
              setError(JSON.parse(rawData) as string);
              setState("error");
              return;
          }
        }
      }

      // 流结束但没有 done 事件
      streamDoneRef.current = true;
      if (!typewriterTimerRef.current && streamDoneRef.current) {
        setState("done");
      }
      clearTimeout(timeoutId);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      streamDoneRef.current = true;
      flushTypewriter();
      if (err instanceof DOMException && err.name === "AbortError") {
        return; // 用户主动中断，不显示错误
      }
      setError("网络错误，请稍后重试");
      setState("error");
    }
  }, [question, documentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 角标渲染 ----

  function renderAnswer(text: string): React.ReactNode[] {
    const refRegex = /\[(\d+)\]/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = refRegex.exec(text)) !== null) {
      // 角标前的文本
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      const refNum = parseInt(match[1], 10);
      const source = sources.find((s) => s.id === refNum);

      parts.push(
        <sup
          key={`ref-${match.index}`}
          className="cursor-pointer text-blue-600 font-bold hover:text-blue-800 hover:underline transition-colors"
          onClick={() => {
            if (source) onSourceClick(source);
          }}
          title={
            source
              ? `第 ${source.page} 页 · 字符 ${source.charStart}-${source.charEnd}`
              : undefined
          }
        >
          [{match[1]}]
        </sup>
      );

      lastIndex = match.index + match[0].length;
    }

    // 剩余文本
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  }

  // 缓存渲染结果，避免每次 typewriter tick 都重新执行正则匹配
  const renderedAnswer = useMemo(
    () => renderAnswer(answer),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [answer, sources]
  );

  // ---- 键盘事件 ----

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  }

  // ---- 渲染 ----

  return (
    <div className="w-full space-y-4">
      {/* ---- 输入区 ---- */}
      <div className="flex gap-3">
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入问题，基于已上传的文档提问..."
          disabled={state === "loading"}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <button
          onClick={handleAsk}
          disabled={state === "loading" || !question.trim()}
          className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors ${
            state === "loading" || !question.trim()
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
          }`}
        >
          {state === "loading" ? "⏳ 分析中..." : "发送"}
        </button>
      </div>

      {/* ---- Loading 状态 ---- */}
      {state === "loading" && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          正在检索文档并生成回答...
        </div>
      )}

      {/* ---- Error 状态 ---- */}
      {state === "error" && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ---- Idle 状态 ---- */}
      {state === "idle" && (
        <div className="text-center text-gray-400 py-6 border border-dashed border-gray-300 rounded-lg text-sm">
          输入问题后点击「发送」，AI 将基于文档内容回答
        </div>
      )}

      {/* ---- Done / 流式进行中 状态 ---- */}
      {(state === "loading" || state === "done") && answer && (
        <div className="space-y-3">
          {/* 答案气泡 */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-xs text-gray-500 mb-2 font-medium">
              🤖 AI 回答
            </div>
            <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
              {renderedAnswer}
              {state === "loading" && (
                <span className="inline-block w-2 h-4 bg-blue-600 animate-pulse ml-0.5 align-middle" />
              )}
            </div>
          </div>

          {/* Sources 列表 */}
          {sources.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">
                📖 引用来源 ({sources.length})
              </div>
              {sources.map((s) => (
                <div
                  key={s.id}
                  className="p-3 bg-white border border-gray-200 rounded-lg text-sm cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  onClick={() => onSourceClick(s)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                      {s.id}
                    </span>
                    <span className="text-xs text-gray-400">
                      第 {s.page} 页 · 字符 {s.charStart} - {s.charEnd}
                    </span>
                  </div>
                  <div className="text-gray-600 text-xs line-clamp-2">
                    {s.snippet}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Done 但无 sources */}
          {state === "done" && sources.length === 0 && (
            <div className="text-xs text-gray-400 py-2">无引用来源</div>
          )}
        </div>
      )}
    </div>
  );
}

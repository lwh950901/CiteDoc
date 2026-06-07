"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { Source } from "@/lib/types";

// ---- Types ----

export type { Source };

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

interface ChatPanelProps {
  documentId: string;
  onSourceClick: (source: Source) => void;
  disabled?: boolean;
  disabledReason?: string;
}

type PanelState = "idle" | "loading" | "done" | "error";

// ---- Component ----

export default function ChatPanel({
  documentId,
  onSourceClick,
  disabled = false,
  disabledReason,
}: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<PanelState>("idle");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 打字机效果
  const typewriterBufferRef = useRef<string[]>([]);
  const typewriterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamDoneRef = useRef(false);
  const pendingAnswerRef = useRef("");
  const pendingSourcesRef = useRef<Source[]>([]);
  const firstCharRef = useRef(false); // 是否已收到第一个字符（替换 loading "…"）

  // 已完成的消息历史（用于 API history 参数，避免依赖 setMessages 捕获）
  const completedHistoryRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  function ensureTypewriter() {
    if (typewriterTimerRef.current) return;
    typewriterTimerRef.current = setInterval(() => {
      const batch = typewriterBufferRef.current.splice(0, 2);
      if (batch.length > 0) {
        pendingAnswerRef.current += batch.join("");
        // 触发重渲染：更新最后一条消息
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = {
              ...last,
              content: pendingAnswerRef.current,
            };
          }
          return copy;
        });
      }
      if (typewriterBufferRef.current.length === 0) {
        clearInterval(typewriterTimerRef.current!);
        typewriterTimerRef.current = null;
        if (streamDoneRef.current) {
          const answer = pendingAnswerRef.current;
          if (answer) {
            completedHistoryRef.current.push({ role: "assistant", content: answer });
          }
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
      pendingAnswerRef.current += typewriterBufferRef.current.join("");
      typewriterBufferRef.current = [];
    }
  }

  useEffect(() => {
    return () => {
      if (typewriterTimerRef.current) {
        clearInterval(typewriterTimerRef.current);
      }
    };
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ---- SSE 流解析 ----

  const handleAsk = useCallback(async () => {
    const q = question.trim();
    if (!q || state === "loading") return;

    // 中断旧请求
    abortRef.current?.abort();

    // 清理旧打字机状态
    flushTypewriter();
    typewriterBufferRef.current = [];
    streamDoneRef.current = false;
    pendingAnswerRef.current = "";
    pendingSourcesRef.current = [];
    firstCharRef.current = false;

    // 追加 user 消息并记录到 history ref
    const userMsg: Message = { role: "user", content: q };
    completedHistoryRef.current.push({ role: "user", content: q });
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    setState("loading");
    setError("");

    // 立即显示 AI 气泡占位（loading 动画），降低感知延迟
    const loadingMsg: Message = { role: "assistant", content: "…", sources: [] };
    setMessages((prev) => [...prev, loadingMsg]);

    // 使用 ref 获取已完成的消息历史（避免依赖 setMessages 批处理时序）
    const history = completedHistoryRef.current.slice();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, question: q, history }),
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

      // loading 占位已在 handleAsk 开头添加，无需重复
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim()) continue;
          const eventMatch = part.match(/^event: (.+)$/m);
          const dataMatch = part.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const eventType = eventMatch[1].trim();
          const rawData = dataMatch[1].trim();

          try {
            switch (eventType) {
            case "sources": {
              pendingSourcesRef.current = JSON.parse(rawData) as Source[];
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last && last.role === "assistant") {
                  copy[copy.length - 1] = { ...last, sources: pendingSourcesRef.current };
                }
                return copy;
              });
              break;
            }
            case "text": {
              const char = JSON.parse(rawData) as string;
              // 第一个字符到达，清除 loading "…"
              if (!firstCharRef.current) {
                firstCharRef.current = true;
                pendingAnswerRef.current = "";
                setMessages((prev) => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  if (last && last.role === "assistant") {
                    copy[copy.length - 1] = { ...last, content: "" };
                  }
                  return copy;
                });
              }
              typewriterBufferRef.current.push(char);
              ensureTypewriter();
              break;
            }
            case "done":
              clearTimeout(timeoutId);
              streamDoneRef.current = true;
              if (!typewriterTimerRef.current) {
                finalizeAnswer();
              }
              return;

            // 辅助：完成当前 assistant 消息并记录 history
            function finalizeAnswer() {
              const answer = pendingAnswerRef.current;
              if (answer) {
                completedHistoryRef.current.push({ role: "assistant", content: answer });
              }
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last && last.role === "assistant") {
                  copy[copy.length - 1] = {
                    ...last,
                    content: answer,
                    sources: pendingSourcesRef.current,
                  };
                }
                return copy;
              });
              setState("done");
            }
            case "error":
              clearTimeout(timeoutId);
              streamDoneRef.current = true;
              flushTypewriter();
              setError(JSON.parse(rawData) as string);
              setMessages((prev) => prev.filter((m) => m.content !== "" || m.role === "user"));
              setState("error");
              return;
          }
          } catch {
            setError("数据格式异常");
            setState("error");
            clearTimeout(timeoutId);
            return;
          }
        }
      }

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
        // 移除占位的空 assistant 消息
        setMessages((prev) => prev.filter((m) => m.content !== "" || m.role === "user"));
        return;
      }
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setError("网络连接异常，请检查网络");
      } else {
        setError("网络错误，请稍后重试");
      }
      setState("error");
    }
  }, [question, documentId, state]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 角标渲染 ----

  function renderContent(text: string, msgSources: Source[]): React.ReactNode[] {
    const refRegex = /\[(\d+)\]/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = refRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const refNum = parseInt(match[1], 10);
      const source = msgSources.find((s) => s.id === refNum);
      parts.push(
        <sup
          key={`ref-${match.index}`}
          className="cursor-pointer font-bold hover:underline transition-colors" style={{color: 'var(--color-accent)'}}
          onClick={() => { if (source) onSourceClick(source); }}
          title={source ? `第 ${source.page} 页 · 字符 ${source.charStart}-${source.charEnd}` : undefined}
        >
          [{match[1]}]
        </sup>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts;
  }

  // ---- 键盘事件 ----

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  }

  // ---- 渲染 ----

  const isSendingDisabled = state === "loading" || !question.trim() || disabled;

  return (
    <div className="w-full flex flex-col min-h-0">
      {/* ---- 消息列表 ---- */}
      <div className="flex-1 overflow-y-auto space-y-5 mb-4 min-h-0 pr-1">
        {messages.length === 0 && state === "idle" && (
          <div className="text-center py-10 rounded-xl text-sm animate-fade-in-up"
            style={{border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', fontFamily: 'DM Sans, sans-serif'}}>
            输入问题，AI 将基于文档内容回答
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          const isLast = i === messages.length - 1;
          const isStreaming = isLast && state === "loading" && msg.role === "assistant";

          return (
            <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in-up`}>
              <div
                className={`max-w-[88%] px-4 py-3 text-sm`}
                style={isUser ? {
                  background: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                  borderRadius: '14px 14px 4px 14px',
                  fontFamily: 'DM Sans, sans-serif',
                  border: '1px solid var(--color-border)',
                } : {
                  background: 'var(--color-glass-bg)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: 'var(--color-doc-text)',
                  borderRadius: '14px 14px 14px 4px',
                  border: '1px solid var(--color-glass-border)',
                  fontFamily: 'Crimson Pro, Georgia, serif',
                  fontSize: '15px',
                  lineHeight: '1.75',
                }}>
                {!isUser && (
                  <div className="text-xs mb-1.5 font-medium opacity-50" style={{fontFamily: 'DM Sans, sans-serif'}}>
                    AI
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">
                  {isUser
                    ? msg.content
                    : renderContent(msg.content, msg.sources || [])}
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-4 animate-pulse ml-0.5 align-middle rounded-sm"
                      style={{background: 'var(--color-accent)'}} />
                  )}
                </div>

                {/* Sources（仅最后一条 assistant 消息，done 状态） */}
                {isLast && state === "done" && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3" style={{borderTop: '1px solid var(--color-border)'}}>
                    <div className="text-xs font-medium mb-2 opacity-40" style={{fontFamily: 'DM Sans, sans-serif'}}>
                      引用来源 · {msg.sources.length}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((s) => (
                        <button
                          key={s.id}
                          className="text-xs rounded-md px-2 py-1 transition-all duration-200"
                          style={{
                            background: 'rgba(212,160,49,0.08)',
                            color: 'var(--color-accent)',
                            border: '1px solid rgba(212,160,49,0.15)',
                            fontFamily: 'DM Sans, sans-serif',
                          }}
                          onClick={() => onSourceClick(s)}
                        >
                          [{s.id}] 第{s.page}页
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {isLast && state === "done" && msg.sources && msg.sources.length === 0 && msg.role === "assistant" && (
                  <div className="mt-2 text-xs opacity-25">无引用来源</div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* ---- Error ---- */}
      {state === "error" && (
        <div className="p-3 rounded-lg text-sm mb-3" style={{background: 'rgba(224,85,106,0.1)', border: '1px solid rgba(224,85,106,0.25)', color: 'var(--color-red)'}}>
          {error}
        </div>
      )}

      {/* ---- 输入区 ---- */}
      <div className="flex gap-3">
        <textarea
          ref={textareaRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入问题…"
          disabled={state === "loading" || disabled}
          rows={1}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm resize-none transition-all duration-200"
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            fontFamily: 'DM Sans, sans-serif',
            outline: 'none',
          }}
        />
        <button
          onClick={handleAsk}
          disabled={isSendingDisabled}
          title={disabled ? disabledReason : undefined}
          className="px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 shrink-0"
          style={{
            fontFamily: 'DM Sans, sans-serif',
            background: isSendingDisabled ? 'var(--color-bg-surface)' : 'var(--color-accent)',
            color: isSendingDisabled ? 'var(--color-text-muted)' : '#0f1117',
            cursor: isSendingDisabled ? 'not-allowed' : 'pointer',
            opacity: isSendingDisabled ? 0.5 : 1,
          }}
        >
          {state === "loading" ? "思考中…" : "发送"}
        </button>
      </div>
      {disabled && disabledReason && (
        <p className="text-xs mt-1.5 opacity-40" style={{color: 'var(--color-accent)'}}>{disabledReason}</p>
      )}
    </div>
  );
}

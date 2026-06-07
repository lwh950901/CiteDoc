"use client";

import { useState, useRef } from "react";

interface Source {
  id: number;
  page: number;
  charStart: number;
  charEnd: number;
  snippet: string;
}

interface QAResponse {
  answer: string;
  sources: Source[];
}

type QAState = "idle" | "loading" | "done" | "error";

export default function QAPanel({ documentId }: { documentId: string }) {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<QAState>("idle");
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAsk = async () => {
    const q = question.trim();
    if (!q) return;

    setState("loading");
    setError("");
    setAnswer("");
    setSources([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, question: q }),
      });

      const data: QAResponse & { error?: string } = await res.json();

      if (!res.ok) {
        setError(data.error || "问答请求失败");
        setState("error");
        return;
      }

      setAnswer(data.answer);
      setSources(data.sources);
      setState("done");
    } catch {
      setError("网络错误，请稍后重试");
      setState("error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <div className="w-full max-w-2xl space-y-4">
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
          {state === "loading" ? "⏳ 分析中..." : "提问"}
        </button>
      </div>

      {/* ---- Loading 状态 ---- */}
      {state === "loading" && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
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
          输入问题后点击「提问」，AI 将基于文档内容回答
        </div>
      )}

      {/* ---- Done: 答案 + Sources ---- */}
      {state === "done" && (
        <div className="space-y-4">
          {/* 答案区 */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-xs text-gray-500 mb-2 font-medium">
              🤖 AI 回答
            </div>
            <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
              {answer}
            </div>
          </div>

          {/* Sources 溯源列表 */}
          {sources.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">
                📖 引用来源 ({sources.length})
              </div>
              {sources.map((s) => (
                <div
                  key={s.id}
                  className="p-3 bg-white border border-gray-200 rounded-lg text-sm"
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

          {/* 无来源 */}
          {sources.length === 0 && (
            <div className="text-xs text-gray-400 py-2">无引用来源</div>
          )}
        </div>
      )}
    </div>
  );
}

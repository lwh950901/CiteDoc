"use client";

import { useChat } from "ai/react";
import { useEffect } from "react";
import FileUpload from "@/components/FileUpload";

function AnimatedCursor() {
  return (
    <span className="inline-block w-2 h-5 bg-green-500 ml-0.5 animate-pulse align-text-bottom" />
  );
}

export default function Home() {
  const { messages, append, isLoading } = useChat({
    api: "/api/chat",
  });

  useEffect(() => {
    console.log("Messages:", messages);
  }, [messages]);

  const handleTestConnection = async () => {
    await append({ role: "user", content: "test" });
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">DocQATracer</h1>
      <p className="text-gray-500 mb-8">文档问答溯源工具</p>

      {/* ---- 文档上传区域 ---- */}
      <section className="w-full mb-10 p-6 border border-dashed border-gray-300 rounded-xl bg-gray-50">
        <h2 className="text-lg font-semibold mb-4">📄 上传文档</h2>
        <FileUpload />
      </section>

      {/* ---- AI 对话区域 ---- */}
      <section className="w-full">
        <h2 className="text-lg font-semibold mb-4">🤖 AI 问答测试</h2>

        <div className="w-full mb-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 py-6 border rounded-lg">
              点击下方按钮测试 DeepSeek 连接
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`mb-3 p-4 rounded-lg ${
                m.role === "user"
                  ? "bg-blue-50 border border-blue-200"
                  : "bg-green-50 border border-green-200"
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">
                {m.role === "user" ? "🧑 用户" : "🤖 AI"}
              </div>
              <div className="whitespace-pre-wrap">
                {m.content}
                {isLoading && m.role === "assistant" && <AnimatedCursor />}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleTestConnection}
          disabled={isLoading}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            isLoading
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
          }`}
        >
          {isLoading ? "⏳ 连接中..." : "🔌 测试连接"}
        </button>
      </section>
    </main>
  );
}

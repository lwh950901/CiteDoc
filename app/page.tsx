"use client";

import FileUpload from "@/components/FileUpload";
import QAPanel from "@/components/QAPanel";

// 测试用文档 ID（Phase 6 加文档选择器）
const TEST_DOC_ID = "a093771f-578a-4bb0-940f-1cafe75e3c0c";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">DocQATracer</h1>
      <p className="text-gray-500 mb-8">文档问答溯源工具</p>

      {/* ---- 文档上传区域 ---- */}
      <section className="w-full mb-10 p-6 border border-dashed border-gray-300 rounded-xl bg-gray-50">
        <h2 className="text-lg font-semibold mb-4">📄 上传文档</h2>
        <FileUpload />
      </section>

      {/* ---- AI 问答区域 ---- */}
      <section className="w-full">
        <h2 className="text-lg font-semibold mb-4">🤖 文档问答</h2>
        <QAPanel documentId={TEST_DOC_ID} />
      </section>
    </main>
  );
}

"use client";

import { useState, useRef } from "react";
import type { Segment } from "@/lib/parser";

type UploadState = "idle" | "uploading" | "success" | "error";

interface UploadResult {
  documentId: string;
  name: string;
  pageCount: number;
  segments: Segment[];
}

export default function FileUpload() {
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("请先选择文件");
      setState("error");
      return;
    }

    setState("uploading");
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "上传失败");
        setState("error");
        return;
      }

      setResult(data);
      setState("success");
    } catch (err) {
      setError("网络错误，请检查连接后重试");
      setState("error");
    }
  };

  const handleReset = () => {
    setState("idle");
    setError("");
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full max-w-lg">
      {/* ---- Idle / Uploading / Error 状态 ---- */}
      {(state === "idle" || state === "uploading" || state === "error") && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              className="flex-1 text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <button
              onClick={handleUpload}
              disabled={state === "uploading"}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                state === "uploading"
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {state === "uploading" ? "上传中..." : "上传"}
            </button>
          </div>

          {/* ---- Error 提示 ---- */}
          {state === "error" && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
      )}

      {/* ---- Uploading 进度提示 ---- */}
      {state === "uploading" && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          正在解析文档...
        </div>
      )}

      {/* ---- Success 状态 ---- */}
      {state === "success" && result && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
              <span>✅</span>
              <span>上传成功</span>
            </div>
            <dl className="text-sm text-gray-600 space-y-1">
              <div className="flex gap-2">
                <dt className="font-medium text-gray-500">文档 ID:</dt>
                <dd className="font-mono text-xs break-all">{result.documentId}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-gray-500">文件名:</dt>
                <dd>{result.name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-gray-500">页数:</dt>
                <dd>{result.pageCount}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-gray-500">段落数:</dt>
                <dd>{result.segments.length}</dd>
              </div>
            </dl>
          </div>

          {/* ---- 段落预览（前 5 个）---- */}
          {result.segments.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-500">
                段落预览（前 {Math.min(5, result.segments.length)} 个）
              </h3>
              {result.segments.slice(0, 5).map((seg, i) => (
                <div
                  key={i}
                  className="p-3 bg-white border border-gray-200 rounded-lg text-sm"
                >
                  <div className="text-xs text-gray-400 mb-1">
                    第 {seg.page} 页 · 字符 {seg.charStart}-{seg.charEnd}
                  </div>
                  <div className="text-gray-700 line-clamp-2">
                    {seg.content}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ---- 重新上传 ---- */}
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            ← 上传新文件
          </button>
        </div>
      )}
    </div>
  );
}

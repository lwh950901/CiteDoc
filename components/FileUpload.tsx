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

interface FileUploadProps {
  onUploadSuccess?: (documentId: string) => void;
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
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
      onUploadSuccess?.(data.documentId);
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

      {/* ---- Success 状态（紧凑模式）---- */}
      {state === "success" && result && (
        <div className="flex items-center gap-3 py-1.5 px-3 bg-green-50 border border-green-200 rounded-lg text-sm">
          <span className="text-green-600">✅</span>
          <span className="text-gray-700 font-medium truncate max-w-[60%]">
            {result.name}
          </span>
          <span className="text-gray-400 text-xs whitespace-nowrap">
            {result.pageCount} 页 · {result.segments.length} 段
          </span>
          <button
            onClick={handleReset}
            className="ml-auto px-3 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors font-medium shrink-0"
          >
            ← 换文件
          </button>
        </div>
      )}
    </div>
  );
}

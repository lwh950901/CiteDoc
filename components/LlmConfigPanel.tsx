"use client";

import { useState } from "react";
import type { LlmCredentials } from "@/hooks/useLlmConfig";

interface LlmConfigPanelProps {
  onSave: (credentials: LlmCredentials) => void;
}

export default function LlmConfigPanel({ onSave }: LlmConfigPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("deepseek-chat");
  const [fieldError, setFieldError] = useState("");

  function handleSave() {
    const trimmedKey = apiKey.trim();
    const trimmedModel = model.trim();
    if (!trimmedKey || !trimmedModel) {
      setFieldError("请填写 API Key 和模型名称");
      return;
    }
    setFieldError("");
    onSave({ apiKey: trimmedKey, model: trimmedModel });
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0 rounded-xl px-6 py-10"
      style={{ border: "1px dashed var(--color-border)", background: "var(--color-bg-raised)" }}>
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <div className="text-4xl mb-4 opacity-15">◈</div>
          <h2 className="text-base font-medium mb-2" style={{ fontFamily: "DM Sans, sans-serif" }}>
            配置 DeepSeek
          </h2>
          <p className="text-sm opacity-40 leading-relaxed" style={{ fontFamily: "DM Sans, sans-serif" }}>
            问答需要 DeepSeek API Key。若已在{" "}
            <code className="text-xs opacity-70">.env.local</code>{" "}
            中设置 <code className="text-xs opacity-70">LLM_API_KEY</code> 与{" "}
            <code className="text-xs opacity-70">LLM_MODEL</code>，重启开发服务器后将自动使用，无需在此填写。
          </p>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs opacity-50 mb-1.5 block" style={{ fontFamily: "DM Sans, sans-serif" }}>
              API Key
            </span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-2.5 rounded-xl text-sm"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
                fontFamily: "DM Sans, sans-serif",
                outline: "none",
              }}
            />
          </label>

          <label className="block">
            <span className="text-xs opacity-50 mb-1.5 block" style={{ fontFamily: "DM Sans, sans-serif" }}>
              模型
            </span>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="deepseek-chat"
              className="w-full px-4 py-2.5 rounded-xl text-sm"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
                fontFamily: "DM Sans, sans-serif",
                outline: "none",
              }}
            />
          </label>
        </div>

        {fieldError && (
          <p className="text-xs" style={{ color: "var(--color-red)" }}>
            {fieldError}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          className="w-full px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200"
          style={{
            background: "var(--color-accent)",
            color: "var(--color-accent-fg)",
            fontFamily: "DM Sans, sans-serif",
          }}
        >
          保存并开始问答
        </button>

        <p className="text-xs text-center opacity-35 leading-relaxed" style={{ fontFamily: "DM Sans, sans-serif" }}>
          还没有 Key？前往{" "}
          <a
            href="https://platform.deepseek.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: "var(--color-accent)" }}
          >
            platform.deepseek.com
          </a>{" "}
          注册获取。配置将保存在浏览器 localStorage，请勿在公共电脑上使用。
        </p>
      </div>
    </div>
  );
}

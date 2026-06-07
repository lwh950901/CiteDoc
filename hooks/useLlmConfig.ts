"use client";

import { useCallback, useEffect, useState } from "react";

export const LLM_CONFIG_STORAGE_KEY = "docqa-llm-config";

export interface LlmCredentials {
  apiKey: string;
  model: string;
}

interface LlmConfigStatus {
  configured: boolean;
  source: "env" | "none";
  model?: string;
}

function isValidCredentials(value: unknown): value is LlmCredentials {
  if (!value || typeof value !== "object") return false;
  const { apiKey, model } = value as Record<string, unknown>;
  return (
    typeof apiKey === "string" &&
    apiKey.trim().length > 0 &&
    typeof model === "string" &&
    model.trim().length > 0
  );
}

export function readStoredLlmCredentials(): LlmCredentials | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LLM_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidCredentials(parsed)) return null;
    return { apiKey: parsed.apiKey.trim(), model: parsed.model.trim() };
  } catch {
    return null;
  }
}

export function writeStoredLlmCredentials(credentials: LlmCredentials): void {
  localStorage.setItem(LLM_CONFIG_STORAGE_KEY, JSON.stringify(credentials));
}

export function clearStoredLlmCredentials(): void {
  localStorage.removeItem(LLM_CONFIG_STORAGE_KEY);
}

export function useLlmConfig() {
  const [loading, setLoading] = useState(true);
  const [serverConfigured, setServerConfigured] = useState(false);
  const [clientCredentials, setClientCredentials] =
    useState<LlmCredentials | null>(null);
  const [forceShowPanel, setForceShowPanel] = useState(false);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/llm-config", { signal: controller.signal });
        if (!res.ok) throw new Error("llm-config failed");
        const data = (await res.json()) as LlmConfigStatus;
        if (ignore) return;

        setServerConfigured(data.configured);
        if (data.configured) {
          setClientCredentials(null);
        } else {
          setClientCredentials(readStoredLlmCredentials());
        }
      } catch {
        if (!ignore) {
          setServerConfigured(false);
          setClientCredentials(readStoredLlmCredentials());
        }
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const llmReady = serverConfigured || clientCredentials !== null;
  const showConfigPanel =
    !loading && !serverConfigured && (!clientCredentials || forceShowPanel);

  const saveCredentials = useCallback((credentials: LlmCredentials) => {
    writeStoredLlmCredentials(credentials);
    setClientCredentials(credentials);
    setForceShowPanel(false);
  }, []);

  const openConfigPanel = useCallback(() => {
    setForceShowPanel(true);
  }, []);

  const clearCredentials = useCallback(() => {
    clearStoredLlmCredentials();
    setClientCredentials(null);
    setForceShowPanel(true);
  }, []);

  return {
    loading,
    serverConfigured,
    llmReady,
    showConfigPanel,
    llmCredentials: serverConfigured ? undefined : clientCredentials ?? undefined,
    saveCredentials,
    openConfigPanel,
    clearCredentials,
  };
}

import OpenAI from "openai";

export const DEFAULT_LLM_MODEL = "deepseek-v4-flash";
export const DEFAULT_LLM_BASE_URL = "https://api.deepseek.com/v1";

export interface ResolvedLlmConfig {
  apiKey: string;
  model: string;
  baseURL: string;
  source: "env" | "request";
}

export interface LlmConfigRequestBody {
  llmApiKey?: string;
  llmModel?: string;
}

/** 服务端 env 是否已配置 LLM API Key */
export function isServerEnvConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY?.trim());
}

/** 解析服务端 env 中的模型名（含默认值） */
export function getServerEnvModel(): string {
  return process.env.LLM_MODEL?.trim() || DEFAULT_LLM_MODEL;
}

/**
 * 解析 LLM 凭据：env 优先，请求体兜底。
 * 两者均不可用则返回 null。
 */
export function resolveLlmConfig(
  body?: LlmConfigRequestBody
): ResolvedLlmConfig | null {
  const envKey = process.env.LLM_API_KEY?.trim();
  if (envKey) {
    return {
      apiKey: envKey,
      model: getServerEnvModel(),
      baseURL: process.env.LLM_BASE_URL?.trim() || DEFAULT_LLM_BASE_URL,
      source: "env",
    };
  }

  const requestKey = body?.llmApiKey?.trim();
  const requestModel = body?.llmModel?.trim();
  if (requestKey && requestModel) {
    return {
      apiKey: requestKey,
      model: requestModel,
      baseURL: process.env.LLM_BASE_URL?.trim() || DEFAULT_LLM_BASE_URL,
      source: "request",
    };
  }

  return null;
}

/** 按解析结果创建 OpenAI 兼容客户端（DeepSeek 等） */
export function createLlmClient(config: ResolvedLlmConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}

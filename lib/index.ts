// DocQATracer 统一类型导出
export type { Segment, ParseResult } from "./parser";
export type { ChunkWithMeta, ChunkMetadata } from "./splitter";
export { splitTextWithMeta } from "./splitter";
export type { EmbeddingResult } from "./embeddings";
export { embedChunks, getEmbeddingProgress } from "./embeddings";
export type { RetrievedChunk } from "./retriever";
export { retrieveChunks } from "./retriever";
export { buildQAPrompt } from "./prompt";
export type { ResolvedLlmConfig, LlmConfigRequestBody } from "./llm-config";
export {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_BASE_URL,
  isServerEnvConfigured,
  getServerEnvModel,
  resolveLlmConfig,
  createLlmClient,
} from "./llm-config";

// DocQATracer 统一类型导出
export type { Segment, ParseResult } from "./parser";
export type { ChunkWithMeta, ChunkMetadata } from "./splitter";
export { splitTextWithMeta } from "./splitter";
export type { EmbeddingResult } from "./embeddings";
export { embedChunks, getEmbeddingProgress } from "./embeddings";

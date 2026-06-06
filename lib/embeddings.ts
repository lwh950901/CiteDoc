import OpenAI from "openai";
import { db } from "./db";
import { chunks } from "@/db/schema";
import { eq, isNull, isNotNull, and, sql } from "drizzle-orm";

// ---- SiliconFlow 客户端（延迟初始化，避免模块加载时 key 缺失报错）----
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.SILICONFLOW_API_KEY,
      baseURL: "https://api.siliconflow.cn/v1",
    });
  }
  return _client;
}

/** 嵌入模型：BAAI/bge-m3，1024 维，免费 */
const EMBEDDING_MODEL = "BAAI/bge-m3";
/** 每批最多文本数 */
const BATCH_SIZE = 20;
/** 最大重试次数 */
const MAX_RETRIES = 2;

// ---- 类型 ----

/** 单条向量化结果 */
export interface EmbeddingResult {
  chunkId: string;
  success: boolean;
  error?: string;
}

// ---- 内部函数 ----

/**
 * 调用 SiliconFlow API 为一批文本生成向量
 * @returns 1024 维浮点数组的数组，顺序与输入一致
 */
async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await getClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  // API 返回的 data 数组顺序与 input 一致
  return response.data.map((d) => d.embedding);
}

// ---- 公开函数 ----

/**
 * 对未向量化的 chunks 执行批量 Embedding
 *
 * 查询 embedding IS NULL 的 chunk → 分批调用 SiliconFlow BGE-M3 →
 * 指数退避重试 → 写入 pgvector。幂等：已完成的记录自动跳过。
 *
 * @param documentId - 可选，限定只处理指定文档的 chunk
 * @returns 每条 chunk 的处理结果
 */
export async function embedChunks(
  documentId?: string
): Promise<EmbeddingResult[]> {
  // ---- 1. 查询待处理 chunk（幂等：只查 embedding IS NULL）----
  const pendingChunks = await db
    .select()
    .from(chunks)
    .where(
      documentId
        ? and(isNull(chunks.embedding), eq(chunks.documentId, documentId))
        : isNull(chunks.embedding)
    );

  if (pendingChunks.length === 0) {
    return [];
  }

  const results: EmbeddingResult[] = [];

  // ---- 2. 分批处理 ----
  for (let i = 0; i < pendingChunks.length; i += BATCH_SIZE) {
    const batch = pendingChunks.slice(i, i + BATCH_SIZE);

    // 过滤空内容（防御性编程）
    const validBatch = batch.filter((c) => c.content.length > 0);
    for (const c of batch) {
      if (c.content.length === 0) {
        results.push({
          chunkId: c.id,
          success: false,
          error: "Empty content",
        });
      }
    }

    if (validBatch.length === 0) continue;

    const texts = validBatch.map((c) => c.content);

    // ---- 2a. 调用 API，带重试 ----
    let embeddings: number[][] | null = null;
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        embeddings = await embedBatch(texts);
        break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt === MAX_RETRIES) {
          // 重试耗尽：该批次全部标记失败
          for (const c of validBatch) {
            results.push({
              chunkId: c.id,
              success: false,
              error: lastError,
            });
          }
        } else {
          // 指数退避
          await new Promise((r) =>
            setTimeout(r, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    // ---- 2b. 写入 pgvector ----
    if (embeddings) {
      for (let j = 0; j < validBatch.length; j++) {
        try {
          const vectorLiteral = `[${embeddings[j].join(",")}]`;
          await db
            .update(chunks)
            .set({ embedding: sql`${vectorLiteral}::vector` })
            .where(eq(chunks.id, validBatch[j].id));
          results.push({
            chunkId: validBatch[j].id,
            success: true,
          });
        } catch (err: unknown) {
          results.push({
            chunkId: validBatch[j].id,
            success: false,
            error:
              err instanceof Error ? err.message : "DB write failed",
          });
        }
      }
    }
  }

  return results;
}

/**
 * 查询指定文档的向量化进度
 *
 * @param documentId - 文档 UUID
 * @returns total: chunk 总数, embedded: 已完成向量化的数量
 */
export async function getEmbeddingProgress(documentId: string) {
  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(chunks)
    .where(eq(chunks.documentId, documentId));

  const [embeddedRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(chunks)
    .where(
      and(
        eq(chunks.documentId, documentId),
        isNotNull(chunks.embedding)
      )
    );

  return {
    total: Number(totalRow?.count ?? 0),
    embedded: Number(embeddedRow?.count ?? 0),
  };
}

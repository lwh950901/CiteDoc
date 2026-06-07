import OpenAI from "openai";
import { db } from "./db";
import { sql } from "drizzle-orm";

// ---- SiliconFlow 客户端（延迟初始化，复用 BAAI/bge-m3）----
let _embedClient: OpenAI | null = null;

function getEmbedClient(): OpenAI {
  if (!_embedClient) {
    _embedClient = new OpenAI({
      apiKey: process.env.SILICONFLOW_API_KEY,
      baseURL: "https://api.siliconflow.cn/v1",
    });
  }
  return _embedClient;
}

const EMBEDDING_MODEL = "BAAI/bge-m3";

// ---- 类型 ----

export interface RetrievedChunk {
  id: string;
  content: string;
  metadata: {
    page: number;
    charStart: number;
    charEnd: number;
  };
  /** 余弦相似度，0-1 之间，1 = 完全相同 */
  similarity: number;
}

// ---- 公开函数 ----

/**
 * 向量语义检索：用问题向量在 pgvector 中搜索最相似的 chunk
 *
 * @param question - 用户问题文本
 * @param documentId - 限定检索的文档 UUID
 * @param topK - 返回最相似的前 K 条（默认 4）
 * @returns 按相似度降序排列的 chunk 列表
 */
export async function retrieveChunks(
  question: string,
  documentId: string,
  topK: number = 4
): Promise<RetrievedChunk[]> {
  // 1. 生成问题的向量
  const embRes = await getEmbedClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: question,
  });
  const queryEmbedding = embRes.data[0].embedding;

  // 2. pgvector 余弦相似度查询
  //    <=> 是余弦距离（越小越相似），1 - distance = similarity
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  const result = await db.execute(sql`
    SELECT
      c.id,
      c.content,
      c.metadata,
      1 - (c.embedding <=> ${vectorStr}::vector) AS similarity
    FROM chunks c
    WHERE c.document_id = ${documentId}
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${vectorStr}::vector
    LIMIT ${topK}
  `);

  // 3. 格式化返回
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.rows.map((row: any) => {
    let metadata: { page: number; charStart: number; charEnd: number };
    if (typeof row.metadata === "string") {
      metadata = JSON.parse(row.metadata);
    } else {
      metadata = row.metadata as typeof metadata;
    }
    return {
      id: row.id as string,
      content: row.content as string,
      metadata: {
        page: Number(metadata.page ?? 1),
        charStart: Number(metadata.charStart ?? 0),
        charEnd: Number(metadata.charEnd ?? 0),
      },
      similarity: Number(row.similarity),
    };
  });
}

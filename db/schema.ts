import { pgTable, text, uuid, timestamp, vector, index } from "drizzle-orm/pg-core";

/**
 * documents 表 - 存储上传的原始文档
 * - id: UUID 主键
 * - name: 原始文件名
 * - content: 文档全文纯文本
 * - created_at: 上传时间
 */
export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * chunks 表 - 文档切分后的片段及其向量
 * - id: UUID 主键
 * - documentId: 关联的文档 ID
 * - content: 片段文本
 * - embedding: 1536 维向量 (OpenAI text-embedding-ada-002)
 * - metadata: JSON 字符串，含 { page, charStart, charEnd }
 * - HNSW 索引用于余弦相似度加速检索
 */
export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "cascade",
    }),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    metadata: text("metadata"), // JSON: { page, charStart, charEnd }
  },
  (table) => [
    index("embedding_index").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
);

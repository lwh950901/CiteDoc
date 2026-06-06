# Tasks: Phase 4 - Vectorization & Storage (SiliconFlow BGE-M3)

## 1. Schema & Config Update

- [x] 1.1 修改 `db/schema.ts`：`vector(1536)` → `vector(1024)`，适配 bge-m3
- [x] 1.2 重建 chunks 表：`DROP TABLE IF EXISTS chunks` + 重新迁移
- [x] 1.3 更新 `.env.example`：`OPENAI_API_KEY` → `SILICONFLOW_API_KEY`

## 2. Core Embedding Module

- [x] 2.1 创建 `lib/embeddings.ts`：SiliconFlow 客户端配置（baseURL + apiKey）
- [x] 2.2 实现 `embedBatch()` 内部函数：调用 `client.embeddings.create({ model: 'BAAI/bge-m3' })`
- [x] 2.3 实现 `embedChunks()` 主函数：查询未向量化 chunk → 分批处理 → 重试 → 写入 pgvector
- [x] 2.4 实现 `getEmbeddingProgress()` 辅助函数
- [x] 2.5 幂等设计：`isNull(chunks.embedding)` 自动跳过已完成记录

## 3. Embedding API Endpoint

- [x] 3.1 创建 `app/api/documents/[id]/embed/route.ts`：POST 触发 + GET 进度
- [x] 3.2 POST 响应摘要：`{ total, success, failed, failedIds }`
- [x] 3.3 GET 响﻿应进度：`{ total, embedded }`

## 4. Type Exports

- [x] 4.1 更新 `lib/index.ts` 导出 `EmbeddingResult`、`embedChunks`、`getEmbeddingProgress`

## 5. Validation & Testing

- [x] 5.1 TypeScript 编译检查 `npx tsc --noEmit`
- [x] 5.2 上传测试文档 → 确认 chunks 表 embedding 为 NULL
- [x] 5.3 POST `/api/documents/:id/embed` → 验证 success 数量
- [x] 5.4 数据库验证：embedding 1024 维，非 NULL
- [x] 5.5 GET `/api/documents/:id/embed` → 验证进度查询
- [x] 5.6 幂等验证：再次 POST → `total: 0, success: 0`
- [x] 5.7 pgvector 相似度查询 → 语义相近 chunk 排序正确

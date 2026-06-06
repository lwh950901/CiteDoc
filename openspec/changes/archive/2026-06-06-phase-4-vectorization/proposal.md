# Proposal: Phase 4 - Vectorization & Storage

## Why

Phase 3 已完成文本切分并将 chunks 写入数据库，但 `embedding` 列为 NULL——这些 chunks 无法被向量检索所使用。没有向量化，下一阶段的 RAG 问答就无法进行语义相似度搜索。Phase 4 必须将 chunks 批量向量化并写入 pgvector，使检索阶段可以直接用余弦相似度查找最相关的文档片段。

## What Changes

- 新增 `lib/embeddings.ts` 向量化模块：调用硅基流动 SiliconFlow `BAAI/bge-m3` 模型（免费，1024 维），批量生成稠密向量并写入 `chunks.embedding` 列
- 修改 `db/schema.ts`：`chunks.embedding` 维度从 1536 → 1024（适配 bge-m3）
- 新增 `POST /api/documents/:id/embed` 端点：手动触发指定文档的向量化，返回成功/失败统计
- 新增 `GET /api/documents/:id/embed` 端点：查询向量化进度（total/embedded）
- 故意不引入 Pinecone/Weaviate：pgvector 减少外部依赖，向量数据与业务数据同库
- 使用 OpenAI 兼容客户端对接 SiliconFlow，无需额外 SDK
- 设计为幂等操作：已向量化的 chunk 自动跳过，API 中断后可安全重试

## Capabilities

### New Capabilities
- `embedding-generation`: 批量向量化核心逻辑，分批处理 + 指数退避重试 + 幂等跳过 + 进度查询
- `embedding-api`: 向量化触发与进度查询的 API 端点（POST + GET）

### Modified Capabilities
<!-- 不修改已有 spec -->

## Impact

- `lib/embeddings.ts`: 新增，向量化核心逻辑
- `app/api/documents/[id]/embed/route.ts`: 新增，向量化 API 端点（POST + GET）
- `db/schema.ts`: 修改，`vector(1536)` → `vector(1024)`
- `.env.example` / `.env.local`: 新增 `SILICONFLOW_API_KEY`
- `lib/splitter.ts`: 不修改

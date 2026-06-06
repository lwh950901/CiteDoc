# Design: Phase 4 - Vectorization & Storage

## Context

Phase 3 的 `splitTextWithMeta` 已将文档切分为 chunks 并写入 `chunks` 表，`embedding` 列暂为 NULL。Phase 4 需要调用 Embedding 模型为每个 chunk 生成向量并回写数据库。

**关键变化**：从 OpenAI `text-embedding-ada-002`（1536 维，付费）改为硅基流动 SiliconFlow `BAAI/bge-m3`（1024 维，免费）。bge-m3 支持中英文混合场景，最大输入 8192 token，免费额度充足适合 MVP。

**数据库影响**：`chunks.embedding` 列需从 `vector(1536)` 改为 `vector(1024)`。由于目前无重要数据，直接 DROP + 重建更干净。

## Goals / Non-Goals

**Goals:**
- 调用 SiliconFlow BGE-M3 批量生成 1024 维向量，写入 pgvector
- 分批次处理 + 指数退避重试
- 幂等设计：已向量化的 chunk 自动跳过
- 提供进度查询（GET）和手动触发（POST）API

**Non-Goals:**
- 不实现 RAG 检索（Phase 5）
- 不支持自动向量化（上传时触发）
- 不接入其他 Embedding 提供商
- 不支持 force 重新向量化

## Decisions

### D1: BAAI/bge-m3 via SiliconFlow，不接入 OpenAI ada-002

**选择**: 硅基流动 SiliconFlow 的 `BAAI/bge-m3` 模型（1024 维，免费）。

**替代方案**:
- OpenAI `text-embedding-ada-002`（1536 维）: 质量高但付费，MVP 阶段不必要。
- Cohere Embed v3: 付费，需额外 SDK。
- 本地模型（sentence-transformers）: 质量好但需要 GPU/内存，不适合 Vercel 部署。

**选择理由**: 免费、中英文支持好、1024 维检索质量足够。通过 OpenAI 兼容 API 接入，代码改动最小。

### D2: OpenAI 兼容客户端，不引入额外 SDK

**选择**: 使用 `openai` npm 包的 `new OpenAI({ baseURL: 'https://api.siliconflow.cn/v1' })` 配置接入 SiliconFlow。

**替代方案**:
- SiliconFlow 独立 SDK: 不存在官方 Node.js SDK。
- LangChain `SiliconFlowEmbeddings`: 同样依赖封装层，不如直接调用透明。

**选择理由**: SiliconFlow 接口兼容 OpenAI 格式，一行 baseURL 配置即可接入，无需额外依赖。

### D3: 批量 20 条/批 + 指数退避重试 2 次

**选择**: 硬编码 `BATCH_SIZE=20`，失败重试 2 次（`2^attempt * 1000ms` 退避）。

**替代方案**: 逐条调用（太慢）、更大批次（可能触发限流）、参数化 batchSize（过度设计）。

**选择理由**: 20 条在吞吐和安全性间平衡。SiliconFlow 免费额度有 RPM 限制，保守批次更安全。

### D4: 手动触发，不上传时自动向量化

**选择**: 提供 `POST /api/documents/:id/embed` 手动触发 + `GET` 查询进度。

**替代方案**: 上传时自动调用 → 上传响应时间增加 5-10s，错误耦合。

**选择理由**: 手动触发便于调试和成本控制（虽然免费但避免不必要调用）。

### D5: 数据库 vector 维度变更策略

**选择**: 直接 `DROP TABLE IF EXISTS chunks` + 修改 schema `vector(1024)` + 重新迁移。

**替代方案**: `ALTER COLUMN ... TYPE vector(1024)` + `SET embedding = NULL` → 保留表结构但需手动改列。

**选择理由**: 当前无重要数据，直接重建最干净，避免 pgvector 类型转换潜在问题。

### D6: Drizzle sql 模板写入 pgvector

**选择**: 使用 `sql` 模板将浮点数组转为 pgvector：
```ts
sql`'[${embeddings[j].join(',')}]'::vector`
```

**替代方案**: Drizzle 内置 vector 类型序列化（0.38 版本对 UPDATE 支持有限）。

**选择理由**: 利用 Drizzle `sql` 模板保留参数化优势，同时正确处理 pgvector 类型转换。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| **SiliconFlow 服务不可用** | 重试 2 次 + 指数退避；免费服务可用性 < OpenAI，需注意 |
| **bge-m3 维度 1024 < ada-002 1536** | 检索质量略有下降但对 MVP 足够；后续可切换模型 |
| **DROP TABLE 丢失历史数据** | 当前无重要数据；后续改为 ALTER 策略 |
| **免费额度耗尽** | bge-m3 在 SiliconFlow 上免费额度充足（通常 > 10M tokens）|

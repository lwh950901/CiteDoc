# Spec: Embedding Generation

## ADDED Requirements

### Requirement: Batch vectorization of unembedded chunks

系统 SHALL 提供 `embedChunks` 函数，查询 `chunks` 表中 `embedding` 为 NULL 的记录，调用 SiliconFlow `BAAI/bge-m3` 模型批量生成 1024 维向量，并写入对应的 `chunks.embedding` 列。

#### Scenario: Successful batch embedding

- **WHEN** `chunks` 表中存在 15 条未向量化的记录，调用 `embedChunks(documentId)`
- **THEN** 系统按每批 20 条分组，调用 SiliconFlow API 生成向量
- **AND** 所有 15 条记录的 `embedding` 列被更新为非 NULL 的 1024 维向量
- **AND** 函数返回 `EmbeddingResult[]`，每条 `success: true`

#### Scenario: Document-scoped embedding

- **WHEN** 指定 `documentId` 参数调用 `embedChunks(documentId)`
- **THEN** 仅处理该文档的未向量化 chunks，其他文档的 chunks 不受影响

#### Scenario: Empty pending chunks

- **WHEN** `chunks` 表中所有记录的 `embedding` 已非 NULL
- **THEN** 函数返回空数组 `[]`，不发起任何 API 调用

### Requirement: Retry with exponential backoff

系统 SHALL 对 API 调用失败的批次进行重试，最多重试 2 次，每次重试前等待指数退避时间 `2^attempt * 1000ms`。

#### Scenario: API call succeeds on retry

- **WHEN** 第一次 API 调用因网络超时失败，第二次重试成功
- **THEN** 该批次所有 chunk 标记为 `success: true`

#### Scenario: All retries exhausted

- **WHEN** API 调用连续失败超过 2 次
- **THEN** 该批次每个 chunk 标记为 `success: false`，`error` 字段包含最后一次错误信息
- **AND** 不中断后续批次的处理

### Requirement: Idempotency

向量化函数 SHALL 为幂等操作：查询条件限定 `isNull(chunks.embedding)`，重复执行不产生重复 API 调用。

#### Scenario: Repeat execution is safe

- **WHEN** 第一次调用 `embedChunks` 已完成所有 chunk 的向量化
- **THEN** 第二次调用立即返回空数组 `[]`，不发起任何 API 请求

### Requirement: Embedding progress query

系统 SHALL 提供 `getEmbeddingProgress` 函数，返回指定文档的向量化进度。返回值的 `total` 和 `embedded` 字段 SHALL 为 `number` 类型（而非字符串），使用 `Number()` 显式转换 PostgreSQL count 结果。

#### Scenario: Partial progress

- **WHEN** 文档有 10 个 chunks，其中 6 个已向量化
- **THEN** `getEmbeddingProgress(documentId)` 返回 `{ total: 10, embedded: 6 }`
- **AND** `typeof total === "number"` 且 `typeof embedded === "number"`

#### Scenario: Document has no chunks

- **WHEN** 文档存在但 chunks 表无对应记录
- **THEN** 返回 `{ total: 0, embedded: 0 }`
- **AND** `typeof total === "number"` 且 `typeof embedded === "number"`

### Requirement: Concurrency protection for embedding

系统 SHALL 在触发向量化时使用进程内内存锁，防止同一文档的并发重复向量化请求。

#### Scenario: Concurrent embedding requests for same document

- **WHEN** 对同一文档 ID 发起两次重叠的 POST 请求
- **THEN** 第一个请求正常开始处理，第二个请求返回 409 Conflict
- **AND** 响应体包含错误信息说明文档正在向量化中

#### Scenario: Sequential requests are allowed

- **WHEN** 前一次 POST 请求完成后再发起新的 POST 请求
- **THEN** 新请求正常执行，不受之前请求影响

#### Scenario: Different documents run in parallel

- **WHEN** 同时对两个不同文档 ID 发起 POST 请求
- **THEN** 两个请求均正常处理，互不阻塞

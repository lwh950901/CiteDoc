## MODIFIED Requirements

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

## ADDED Requirements

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

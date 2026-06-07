## ADDED Requirements

### Requirement: Vector semantic search

系统 SHALL 提供 `retrieveChunks` 函数，接收问题文本和文档 ID，调用 SiliconFlow BAAI/bge-m3 将问题向量化，在 chunks 表中执行 pgvector 余弦相似度查询，返回与问题语义最相关的 top K chunk 及其元数据。

#### Scenario: Successful retrieval

- **WHEN** 使用有效问题文本和包含已向量化 chunks 的文档 ID 调用 `retrieveChunks(question, documentId, 4)`
- **THEN** 系统生成问题的 1024 维 BGE-M3 向量
- **AND** 在 `chunks` 表中按余弦相似度降序排列，返回 top 4 条记录
- **AND** 每条记录包含 `id`, `content`, `metadata { page, charStart, charEnd }`, `similarity`
- **AND** `similarity` 值在 `[0, 1]` 区间（1 = 完全相同）

#### Scenario: Document has no chunks

- **WHEN** 文档存在但 `chunks` 表中无对应记录（或所有 chunk 的 embedding 为 NULL）
- **THEN** 返回空数组 `[]`

#### Scenario: Document-scoped retrieval

- **WHEN** 指定 `documentId` 参数
- **THEN** 仅在该文档的 chunks 范围内检索，不返回其他文档的 chunk

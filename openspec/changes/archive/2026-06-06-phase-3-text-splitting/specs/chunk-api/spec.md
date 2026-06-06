# Spec: Chunk Debug API

## ADDED Requirements

### Requirement: Get chunks by document ID

系统 SHALL 提供 `GET /api/documents/:id/chunks` 端点，根据文档 ID 返回该文档所有 chunk 的摘要信息。

#### Scenario: Successful chunk retrieval

- **WHEN** 请求一个已存在的文档 ID（该文档已经过切分）
- **THEN** 系统返回 200 状态码，响应体为 chunk 数组
- **AND** 每个 chunk 包含 `id`、`content`（截断前 100 字符）、`metadata`（JSON 对象）
- **AND** 不返回 `embedding` 字段

#### Scenario: Document not found

- **WHEN** 请求一个不存在的文档 ID
- **THEN** 系统返回 404 状态码，错误消息为"文档不存在"

#### Scenario: Document has no chunks

- **WHEN** 请求一个存在但尚未切分的文档 ID
- **THEN** 系统返回 200 状态码，响应体为空数组 `[]`

### Requirement: Content truncation for preview

chunk 的 `content` 字段 SHALL 在返回时截断到前 100 字符，末尾追加 `"..."` 表示截断省略。

#### Scenario: Long content truncated

- **WHEN** 一个 chunk 的 content 长度为 500 字符
- **THEN** 返回的 `content` 字段为前 100 字符 + `"..."`

#### Scenario: Short content not truncated

- **WHEN** 一个 chunk 的 content 长度为 30 字符
- **THEN** 返回的 `content` 字段为完整内容，不含 `"..."`

# Spec: Embedding API

## ADDED Requirements

### Requirement: Trigger embedding via POST

系统 SHALL 提供 `POST /api/documents/:id/embed` 端点，接收文档 ID 作为路径参数。在处理前 SHALL 验证文档是否存在，不存在时返回 404。存在时调用 `embedChunks` 执行向量化，返回处理摘要。

#### Scenario: Successful embedding trigger

- **WHEN** 对包含 10 个未向量化 chunks 的文档发起 POST 请求
- **THEN** 系统返回 200 状态码，响应体包含 `{ total: 10, success: 10, failed: 0, failedIds: [] }`

#### Scenario: Document not found

- **WHEN** 对数据库中不存在的文档 ID 发起 POST 请求
- **THEN** 系统返回 404 状态码，响应体包含 `{ error: "文档不存在" }`

#### Scenario: Partial failure

- **WHEN** 10 个 chunks 中 2 个因 API 错误处理失败
- **THEN** 系统返回 200 状态码，响应体包含 `{ total: 10, success: 8, failed: 2, failedIds: [...] }`

#### Scenario: No chunks to embed

- **WHEN** 文档的所有 chunks 均已向量化
- **THEN** 系统返回 200 状态码，响应体包含 `{ total: 0, success: 0, failed: 0, failedIds: [] }`

### Requirement: Query embedding progress via GET

系统 SHALL 提供 `GET /api/documents/:id/embed` 端点，返回指定文档的向量化进度。在处理前 SHALL 验证文档是否存在，不存在时返回 404。

#### Scenario: Progress query

- **WHEN** 对包含 15 个 chunks（其中 10 个已向量化）的文档发起 GET 请求
- **THEN** 系统返回 200 状态码，响应体包含 `{ total: 15, embedded: 10 }`

#### Scenario: Document not found

- **WHEN** 对数据库中不存在的文档 ID 发起 GET 请求
- **THEN** 系统返回 404 状态码，响应体包含 `{ error: "文档不存在" }`

#### Scenario: Document has no chunks

- **WHEN** 文档存在但无 chunks 记录
- **THEN** 返回 `{ total: 0, embedded: 0 }`

### Requirement: API key error handling

系统 SHALL 在 SiliconFlow API Key 无效时返回明确错误提示。

#### Scenario: Invalid API key

- **WHEN** `SILICONFLOW_API_KEY` 环境变量未配置或无效
- **THEN** 系统返回 500 状态码，错误消息包含"请检查 SILICONFLOW_API_KEY 配置"

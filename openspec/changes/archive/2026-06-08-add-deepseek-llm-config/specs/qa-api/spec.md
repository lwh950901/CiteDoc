## MODIFIED Requirements

### Requirement: Question answering endpoint

系统 SHALL 提供 `POST /api/chat` 端点，接收 `{ documentId, question, history?, llmApiKey?, llmModel? }`，串联"检索 → Prompt 构建 → LLM 调用 → 引用解析"全流程，以 SSE 流式返回 sources、text 与 done 事件。

#### Scenario: Successful QA with citations

- **WHEN** 对包含相关内容的文档发起 POST 请求 `{ documentId, question: "DocQATracer 是什么?" }`
- **AND** LLM 凭据已通过 env 或请求体有效配置
- **THEN** 系统返回 200 状态码，`Content-Type` 为 `text/event-stream`
- **AND** SSE 流包含 `sources` 事件，数组长度 > 0
- **AND** SSE 流包含 `text` 事件，内容为带 `[1]` `[2]` 等引用标记的回答
- **AND** 流以 `done` 事件结束

#### Scenario: No relevant information

- **WHEN** 问题与文档内容完全无关
- **AND** LLM 凭据已有效配置
- **THEN** 系统返回 200 状态码的 SSE 流
- **AND** `text` 事件内容包含 "根据现有资料无法回答" 或等效表述
- **AND** `sources` 事件为空数组 `[]`

#### Scenario: Missing required parameters

- **WHEN** POST body 缺少 `documentId` 或 `question`
- **THEN** SSE 流发送 `error` 事件，消息包含 "缺少 documentId 或 question"

#### Scenario: Use server env credentials

- **WHEN** 服务端 `LLM_API_KEY` 已配置
- **AND** 请求体同时携带 `llmApiKey` 与 `llmModel`
- **THEN** 系统使用 env 中的 LLM 凭据调用 DeepSeek
- **AND** 忽略请求体中的 `llmApiKey` 与 `llmModel`

#### Scenario: Use request body credentials when env missing

- **WHEN** 服务端 `LLM_API_KEY` 未配置
- **AND** 请求体包含非空 `llmApiKey` 与非空 `llmModel`
- **THEN** 系统使用请求体凭据调用 DeepSeek
- **AND** 问答流程正常完成并返回 SSE 流

### Requirement: LLM error handling

系统 SHALL 在 LLM 凭据缺失或调用失败时，通过 SSE `error` 事件返回明确、可操作的中文错误信息，而非让客户端超时等待。

#### Scenario: Missing credentials

- **WHEN** 服务端 `LLM_API_KEY` 未配置
- **AND** 请求体未提供有效的 `llmApiKey` 与 `llmModel`
- **THEN** SSE 流发送 `error` 事件
- **AND** 错误消息包含 "请先配置 DeepSeek API Key 和模型"

#### Scenario: Invalid API key

- **WHEN** LLM 凭据已提供但 DeepSeek 返回认证失败（如 401）
- **THEN** SSE 流发送 `error` 事件
- **AND** 错误消息包含 "DeepSeek API Key 无效" 或等效认证失败提示

#### Scenario: LLM returns empty content

- **WHEN** LLM API 返回成功但 choices 中的 message.content 为空或 null
- **THEN** 系统返回 200 状态码的 SSE 流
- **AND** `text` 事件内容为 "无法获取回答。"

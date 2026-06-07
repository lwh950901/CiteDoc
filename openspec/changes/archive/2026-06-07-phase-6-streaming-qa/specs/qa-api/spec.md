## MODIFIED Requirements

### Requirement: Question answering endpoint

系统 SHALL 提供 `POST /api/chat` 端点，接收 `{ documentId, question }`，串联"检索 → Prompt 构建 → LLM 调用 → 引用解析"全流程，以 SSE（Server-Sent Events）流式响应返回结果，Content-Type 为 `text/event-stream`。

#### Scenario: Successful QA with citations

- **WHEN** 对包含相关内容的文档发起 POST 请求 `{ documentId, question: "DocQATracer 是什么?" }`
- **THEN** 系统返回 200 状态码，Content-Type 为 `text/event-stream`
- **AND** 首个 SSE 事件 `event: sources` 携带 JSON 序列化的 sources 数组，每个 source 包含 `{ id, page, chunkId, charStart, charEnd, snippet }`
- **AND** 随后收到连续的 `event: text` 事件，每个 data 为单个字符
- **AND** 最后收到 `event: done`，data 为 `[DONE]`

#### Scenario: No relevant information

- **WHEN** 问题与文档内容完全无关
- **THEN** 系统返回 200 状态码，Content-Type 为 `text/event-stream`
- **AND** `event: sources` 携带空数组 `[]`
- **AND** `event: text` 逐字推送 "文档中未找到相关信息。" 或 "根据现有资料无法回答"

#### Scenario: Missing required parameters

- **WHEN** POST body 缺少 `documentId` 或 `question`
- **THEN** 系统仍以 SSE 格式返回：`event: error`，data 包含 "缺少 documentId 或 question"

### Requirement: Reference parsing

系统 SHALL 从 LLM 回答中解析 `[数字]` 格式的引用标记，将数字映射回检索到的 chunk 元数据，生成 sources 数组。每个 source 对象 SHALL 包含 `chunkId` 字段（取自 chunk 的数据库主键 `retrieved[ref-1].id`）。

#### Scenario: Parse standard references

- **WHEN** LLM 回答包含 "2025年销售额增长了12%[1]，利润率提升了3个百分点[2]"
- **THEN** `parseReferences` 提取 `[1]` 和 `[2]`
- **AND** sources 数组包含 2 条记录，对应检索结果的第 1 和第 2 个 chunk
- **AND** 每条 source 的 `id` 分别为 1 和 2
- **AND** 每条 source 的 `chunkId` 分别为 `retrieved[0].id` 和 `retrieved[1].id`

#### Scenario: Duplicate references are deduplicated

- **WHEN** LLM 回答中同一引用出现多次，如 "数据表明[1]...进一步分析[1]..."
- **THEN** sources 数组中 `[1]` 仅出现一次

#### Scenario: Out-of-range references are ignored

- **WHEN** LLM 回答中出现 `[5]` 但仅检索到 4 个 chunk
- **THEN** `[5]` 不出现在 sources 数组中

### Requirement: LLM error handling

系统 SHALL 在 LLM 调用失败时以 SSE 错误事件返回明确的错误信息，而非让客户端超时等待。

#### Scenario: Invalid API key

- **WHEN** LLM API Key 无效或未配置
- **THEN** 系统以 SSE 格式返回 `event: error`，data 包含 "LLM 调用失败" 或具体的认证错误信息

#### Scenario: LLM returns empty content

- **WHEN** LLM API 返回成功但 choices 中的 message.content 为空或 null
- **THEN** 系统通过 `event: text` 逐字推送 "无法获取回答。"

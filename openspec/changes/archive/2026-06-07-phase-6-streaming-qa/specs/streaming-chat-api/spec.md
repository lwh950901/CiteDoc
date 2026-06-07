## ADDED Requirements

### Requirement: SSE streaming chat endpoint

系统 SHALL 将 `POST /api/chat` 端点改造为 Server-Sent Events 流式响应，Content-Type 为 `text/event-stream`。后端使用非流式 LLM 调用获取完整答案并解析 sources，然后将答案逐字向前端推送，同时通过自定义事件提前发送 sources 元数据。

#### Scenario: Stream sources then text then done

- **WHEN** 发起有效的 POST 请求 `{ documentId, question }`
- **THEN** 响应 Content-Type 为 `text/event-stream`
- **AND** 首个事件为 `event: sources`，data 为 JSON 序列化的 sources 数组，每个 source 包含 `{ id, page, chunkId, charStart, charEnd, snippet }`
- **AND** 随后为连续的 `event: text` 事件，data 为单个字符
- **AND** 最后为 `event: done`，data 为 `[DONE]`

#### Scenario: Stream no-result message

- **WHEN** 检索到的 chunks 数量为 0
- **THEN** 系统返回 `event: sources` 携带空数组 `[]`
- **AND** 随后 `event: text` 逐字推送 "文档中未找到相关信息。"

#### Scenario: Stream error on missing parameters

- **WHEN** POST body 缺少 `documentId` 或 `question`
- **THEN** 系统仍以 SSE 格式返回错误：`event: error`，data 包含 "缺少 documentId 或 question"

### Requirement: Source object includes chunkId

`parseReferences` 函数 SHALL 在返回的 source 对象中新增 `chunkId` 字段，取自 `retrieved[ref-1].id`（即 chunk 的数据库主键），供前端定位原文 span。

#### Scenario: Source contains chunkId

- **WHEN** LLM 回答包含 `[1]` 且 retrieved[0].id 为 `"c001"`
- **THEN** sources[0].chunkId 为 `"c001"`

### Requirement: No-result streamed response

系统 SHALL 在检索无结果时仍以 SSE 流形式返回提示信息，而非返回 JSON 错误。

#### Scenario: Empty retrieval produces streamed fallback

- **WHEN** `retrieveChunks` 返回空数组
- **THEN** 系统返回 200 状态码，Content-Type 为 `text/event-stream`
- **AND** stream 包含 `event: sources`（空数组）+ `event: text`（逐字推送提示文本）+ `event: done`

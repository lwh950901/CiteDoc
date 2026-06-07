## Why

当前问答接口为非流式 JSON 响应，用户需等待完整答案后才能看到结果（体感延迟高）；前端缺少原文溯源交互——答案中的 `[1]` `[2]` 角标无法点击，用户看不到引用对应的原文位置。这导致 MVP 的"可溯源文档问答"体验不完整，而流式输出+双栏溯源正是面试展示的核心亮点。

## What Changes

- **BREAKING** `POST /api/chat` 从非流式 JSON 响应改为 SSE（Server-Sent Events）流式响应，先发 `sources` 事件再逐字发 `text` 事件，最后 `done`
- sources 对象新增 `chunkId` 字段，前端据此定位原文 span
- 新增 `ChatPanel` 组件替代 `QAPanel`：手动解析 SSE 流、打字机效果逐字显示、`[数字]` 角标解析为可点击 `<sup>` 标签、支持 AbortController 中断
- 新增 `DocumentViewer` 组件：按 chunk `charStart`/`charEnd` 将原文切分为带 `id="chunk-{chunkId}"` 的 `<span>`，接收 `activeChunkId` prop 实现滚动定位 + 背景高亮
- 主页面从单栏改为双栏布局：桌面端左侧原文右侧对话，移动端上下堆叠
- "先完整生成，后流式推送"策略：后端仍使用非流式 LLM 调用确保引用解析完整性，仅向前端模拟流式推送

## Capabilities

### New Capabilities

- `streaming-chat-api`: SSE 流式问答 API，自定义事件 `sources` / `text` / `done`，替代原 JSON 响应
- `chat-panel`: 前端聊天面板，SSE 流解析、打字机效果、角标渲染与点击、中断控制
- `document-viewer`: 原文查看器，按 chunk 切分渲染、滚动定位、高亮动画
- `dual-pane-layout`: 双栏响应式布局，桌面并排 / 移动端堆叠，状态提升协调 ChatPanel 与 DocumentViewer

### Modified Capabilities

- `qa-api`: POST /api/chat 响应格式从 JSON 改为 SSE 流（**BREAKING**）；sources 对象新增 `chunkId` 字段
- `qa-ui`: QAPanel 组件被 ChatPanel + DocumentViewer 双栏方案替代

## Impact

- **API**: `app/api/chat/route.ts` 重写为 SSE 流式端点，前端需改用 `fetch` + `ReadableStream` 替代 `res.json()`
- **组件**: 新增 `ChatPanel.tsx`、`DocumentViewer.tsx`；废弃 `QAPanel.tsx`（可删除）
- **数据**: chunks 表需通过 `GET /api/documents/:id/chunks` 拉取 chunk 列表；sources 需包含 `chunkId`
- **页面**: `app/page.tsx` 重构为双栏布局，增加 `activeChunkId` 状态管理
- **依赖**: 无新增第三方依赖，使用浏览器原生 `ReadableStream`、`EventSource` API

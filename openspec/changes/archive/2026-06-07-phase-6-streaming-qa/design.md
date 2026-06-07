## Context

Phase 5 实现了非流式 RAG 问答，前端 `QAPanel` 等待完整 JSON 响应后一次性渲染。当前状态：`POST /api/chat` 返回 `{ answer, sources }` JSON，前端以简单文本展示答案和 sources 列表。用户需要 3-5 秒才能看到结果，体感延迟高；`[1]` 角标仅是纯文本，无法交互。

Phase 6 的目标是将这一流程升级为流式 SSE 输出 + 双栏溯源交互，让回答以打字机效果逐字出现，且角标可点击定位原文。

## Goals / Non-Goals

**Goals:**
- 后端 `POST /api/chat` 改为 SSE 流式响应，前端以打字机效果逐字显示答案
- sources 元数据提前推送（先于文本），前端解析 `[数字]` 为可点击 `<sup>` 角标
- 原文按 chunk 渲染为带 `id` 的 span，点击角标后左侧滚动到对应位置并高亮
- 桌面端双栏（左原文右对话），移动端上下堆叠
- 支持用户通过 AbortController 中断回答

**Non-Goals:**
- 不改造 LLM 调用为真正的 streaming（token 级流式）（引用完整性优先）
- 不实现多轮对话历史管理（单轮 MVP）
- 不做原文搜索/高亮的关键词匹配（只做 chunk 定位）
- 不引入 WebSocket 或其他推送协议（SSE 足够）

## Decisions

### 1. "先完整生成，后流式推送" 策略

**选择**: 后端使用非流式 LLM 调用获取完整答案 → 解析 sources → 将答案文本逐字以 SSE 推送前端。

**理由**: 答案中的 `[数字]` 标记可能分散在整个回答中，流式状态下未完成的引用无法解析，极易出现闪烁或错误。先拿到完整答案确保 sources 解析正确，前端再模拟流式打字效果。

**备选**: 真正的 LLM streaming + 增量解析。风险是 `[1` 和 `]` 跨 chunk 时无法正确匹配，引用会断裂。Phase 7 可考虑。

### 2. SSE 自定义事件协议

**选择**: 3 种事件类型 — `sources`（元数据）、`text`（单字符）、`done`（结束）。

```
event: sources
data: [{"id":1,"page":2,"chunkId":"abc-123","charStart":1060,"charEnd":1572,"snippet":"..."}]

event: text
data: "学"

event: text
data: "习"

event: done
data: [DONE]
```

**理由**: 自定义事件名让前端 `addEventListener` 精确匹配，无需在 `data` 字段中塞类型标识。`text` 事件按字符粒度为前端提供最大灵活性（可加延迟模拟打字机）。

**备选**: 单 `message` 事件 + JSON 包装 `{ type, data }`。代码量略少，但解析开销更大，且失去 SSE 事件隔离的语义。

### 3. SSE 使用 ReadableStream 而非 EventSource API

**选择**: 后端使用 `ReadableStream` + `TextEncoder` 构造 SSE 响应；前端使用 `fetch` + `response.body.getReader()` 解析流。

**理由**: `EventSource` API 不支持 POST 请求（只能 GET），无法传递 `documentId` 和 `question`。手动 fetch + ReadableStream 更灵活。

**备选**: GET + EventSource + query params。query params 有长度限制且暴露参数，不适合传递长问题文本。

### 4. 原文渲染：按 chunk 切分为带 id 的 span

**选择**: 将 `documents.content` 按 chunks 的 `charStart`/`charEnd` 切分为多个 `<span id="chunk-{chunkId}">`。高亮时操作 DOM 添加/移除 class。

**理由**: 
- 精准定位：每个 chunk 有唯一的 DOM id，`document.getElementById` O(1) 查找
- 独立高亮：每个 span 可独立控制背景色和过渡动画
- chunk 数据来自已有 API `GET /api/documents/:id/chunks`

**备选**: CSS scroll-snap + data attributes。减少 DOM 节点数但滚动定位不够精准。备选：Canvas 渲染全文。过度设计，不符合 MVP 定位。

### 5. sources 新增 chunkId 字段

**选择**: `parseReferences` 返回的 source 对象中新增 `chunkId`（取自 `retrieved[ref-1].id`）。

**理由**: 前端角标点击时需要知道对应的 DOM id（`chunk-{chunkId}`），而原来的 source 只有 `page`/`charStart`/`charEnd`/`snippet`，无法唯一定位 span。chunkId 是数据库主键，天然适合做 DOM id。

### 6. 响应式双栏布局

**选择**: Tailwind `flex flex-col lg:flex-row`，左侧 `DocumentViewer`（`lg:w-[45%]`），右侧 `ChatPanel`（`lg:flex-1`）。

**理由**: 不引入额外的响应式库，Tailwind 的断点系统足以处理桌面/移动端切换。移动端对话在上、原文在下，因为优先展示 AI 回答，原文作为辅助参考。

### 7. 状态提升：主页面管理 activeChunkId

**选择**: `app/page.tsx` 中定义 `const [activeChunkId, setActiveChunkId] = useState<string | null>(null)`，传递给 ChatPanel（onSourceClick）和 DocumentViewer（activeChunkId）。

**理由**: ChatPanel 和 DocumentViewer 是兄弟组件，需要通过共同父组件共享状态。避免引入 Context 或状态管理库（MVP 不需要）。

## Risks / Trade-offs

- **[用户体验] 流式仅模拟，实际响应时间不变**: 打字机效果改善感知速度，但端到端延迟与 Phase 5 相同（LLM 非流式）。→ 可接受：体感改善显著（看到首字即反馈），且引用完整性更有价值。
- **[性能] 按字符推送 SSE 事件量大**: 500 字答案 = 500 个 `text` 事件 + 500 次 React state 更新。→ 生产环境可改为按词/按短句推送减少事件数；MVP 阶段 500 次更新在 React 18 批量渲染下性能可接受。
- **[DOM 规模] 原文按 chunk 切分为大量 span**: 长文档（50000+ 字符）+ 细粒度 chunk → 数百个 span。→ chunk 数量由 Phase 3 切分策略控制（通常几十个），且 span 为纯展示元素无交互，性能风险低。
- **[向后兼容] POST /api/chat 响应格式 BREAKING**: 原 JSON `{ answer, sources }` 改为 SSE 流。→ Phase 5 前端 `QAPanel` 将被删除，不影响其他代码。
- **[竞态] 用户快速连续提问**: 旧请求的 SSE 流可能在新请求发起后仍然推送数据。→ 使用 AbortController 中断旧请求，且 ChatPanel 在 `loading` 期间禁用输入框。

## Migration Plan

1. 先改造后端 `app/api/chat/route.ts` 为 SSE（保留 `retrieveChunks`、`buildQAPrompt`、`parseReferences` 核心逻辑）
2. 实现 `components/DocumentViewer.tsx`（独立组件，可单独测试）
3. 实现 `components/ChatPanel.tsx` + 删除 `components/QAPanel.tsx`
4. 重构 `app/page.tsx` 双栏布局 + 状态提升
5. curl 测试 SSE 端点 → 浏览器手动测试 → 验证 checklist

**回滚**: 无数据库迁移，仅代码变更。回滚即 `git revert`。

## Open Questions

- 字符间延迟经验值？建议从 30ms 开始，可根据实际体验调整
- chunks 的 charStart/charEnd 跨段落时，原文 span 边界是否会有换行符/空格问题？需实测验证

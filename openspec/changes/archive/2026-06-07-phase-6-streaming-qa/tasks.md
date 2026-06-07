## 1. 改造后端为 SSE 流式响应

- [x] 1.1 修改 `parseReferences` 函数，在 source 对象中新增 `chunkId` 字段（取自 `retrieved[ref-1].id`）
- [x] 1.2 重写 `POST /api/chat` 为 SSE 流式端点：`Content-Type: text/event-stream`，使用 `ReadableStream` + `TextEncoder`
- [x] 1.3 实现 SSE 事件序列：先发 `event: sources`（JSON 序列化的 sources 数组），再逐字发 `event: text`，最后发 `event: done`
- [x] 1.4 处理边界情况：检索无结果时流式返回提示；参数缺失时返回 `event: error`；LLM 错误时返回 `event: error`

## 2. 创建 ChatPanel 组件

- [x] 2.1 创建 `components/ChatPanel.tsx`：输入框 + 发送按钮，loading/idle/done/error 四态管理
- [x] 2.2 实现 `fetch` + `ReadableStream` 手动解析 SSE 流，按事件类型分发处理
- [x] 2.3 实现打字机效果：逐字追加到答案区，显示闪烁光标 `▍`
- [x] 2.4 实现 `renderAnswer` 函数：正则 `\[(\d+)\]` 将引用替换为可点击 `<sup>` 标签
- [x] 2.5 实现 AbortController 中断机制：新问题提交时中断旧请求，`loading` 期间输入框 disabled
- [x] 2.6 ChatPanel 接收 `onSourceClick` 回调 prop，角标点击时传递对应 source 对象

## 3. 创建 DocumentViewer 组件

- [x] 3.1 创建 `components/DocumentViewer.tsx`：接收 `documentId` 和 `activeChunkId` props
- [x] 3.2 加载数据：调用 `GET /api/documents/:id` 获取原文 `content`，调用 `GET /api/documents/:id/chunks` 获取 chunk 列表
- [x] 3.3 实现 `renderTextWithChunks`：按 `charStart`/`charEnd` 将原文切分为 `<span id="chunk-{chunkId}">`
- [x] 3.4 实现高亮逻辑：`useEffect` 监听 `activeChunkId` 变化，移除旧 span 的 `bg-yellow-100`，为新 span 添加高亮
- [x] 3.5 实现滚动定位：`document.getElementById('chunk-xxx')?.scrollIntoView({ behavior: 'smooth', block: 'center' })`
- [x] 3.6 容器固定高度 + `overflow-y-auto`，处理无 chunks 数据时的降级渲染

## 4. 组装双栏布局主页面

- [x] 4.1 重构 `app/page.tsx`：双栏布局，`flex-col lg:flex-row`，左侧 DocumentViewer 右侧 ChatPanel
- [x] 4.2 状态提升：页面组件管理 `activeChunkId` 状态，ChatPanel 的 `onSourceClick` 设置它，DocumentViewer 的 props 响应它
- [x] 4.3 设定 DocumentViewer 宽度约 45%（`lg:w-[45%]`），ChatPanel 占剩余空间（`lg:flex-1`）
- [x] 4.4 移动端：`flex-col`，ChatPanel 在上，DocumentViewer 在下，均占满宽

## 5. 清理与收尾

- [x] 5.1 删除旧组件 `components/QAPanel.tsx`（已由 ChatPanel 替代）
- [x] 5.2 确认 `lib/index.ts` 中不再导出 QAPanel 相关的内容（如有）

## 6. 验证

- [x] 6.1 `npx tsc --noEmit` 确保无类型错误
- [x] 6.2 curl 测试 SSE 端点：确认 Content-Type 为 `text/event-stream`，事件顺序为 sources → text... → done
- [x] 6.3 curl 测试 sources 包含 `chunkId` 字段
- [x] 6.4 curl 测试参数缺失返回 `event: error`
- [x] 6.5 浏览器测试：打字机效果逐字显示，角标可点击
- [x] 6.6 浏览器测试：点击角标后左侧原文滚动到对应位置并高亮
- [x] 6.7 浏览器测试：移动端视口下布局切换为上下结构，角标点击仍有效
- [x] 6.8 浏览器测试：中断请求（快速切换问题），无状态残留

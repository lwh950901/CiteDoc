## 1. 多轮对话 — 后端

- [x] 1.1 `app/api/chat/route.ts`: 请求体新增可选 `history` 字段
- [x] 1.2 `app/api/chat/route.ts`: 取最近 10 条历史消息拼入 LLM messages
- [x] 1.3 `lib/prompt.ts`: 系统提示词增加 "结合对话历史理解上下文" 指令

## 2. 多轮对话 — 前端

- [x] 2.1 `components/ChatPanel.tsx`: 单 `answer` 状态改为 `messages: Message[]` 数组
- [x] 2.2 发送问题时追加 user 消息，构建 history 传入 API
- [x] 2.3 AI 回答完成后追加 assistant 消息（含 sources）
- [x] 2.4 渲染对话气泡（user 蓝底右对齐，assistant 灰底左对齐）
- [x] 2.5 流式输出中发送新消息时中断当前请求，不追加未完成回答

## 3. 错误处理 — 后端

- [x] 3.1 chat route 已有超时+auth 区分
- [x] 3.2 upload route 已有规范状态码（400/413/500）
- [x] 3.3 embed route 已有文档存在性校验（404）+ 并发锁（409）+ API Key 区分

## 4. 错误处理 — 前端

- [x] 4.1 ChatPanel: 网络断开提示 "网络连接异常，请检查网络"
- [x] 4.2 ChatPanel: JSON.parse 错误显示 "数据格式异常"
- [x] 4.3 DocUploadPanel: 401/413/429 错误区分展示
- [x] 4.4 DocumentViewer: 原文超长（>500KB）截断 + 提示

## 5. UX 打磨

- [x] 5.1 FileUpload: 上传后轮询向量化进度，显示进度条
- [x] 5.2 ChatPanel: disabled prop 支持向量化完成前禁用
- [x] 5.3 ChatPanel: textarea + Enter 发送 / Shift+Enter 换行
- [x] 5.4 ChatPanel: 发送后自动清空输入框
- [x] 5.5 ChatPanel: 新消息自动滚动到底部
- [x] 5.6 page.tsx: 高亮 3 秒后自动清除 activeChunkId

## 6. 移动端 + 空状态

- [x] 6.1 `< 768px` Tab 切换（原文 / 问答）
- [x] 6.2 移动端角标点击自动切换到原文 Tab
- [x] 6.3 空状态引导文案优化

## 7. 验证

- [x] 7.1 `npx tsc --noEmit` TypeScript 编译通过
- [x] 7.2 浏览器测试：多轮对话 + 溯源正常
- [x] 7.3 浏览器测试：移动端 Tab 切换

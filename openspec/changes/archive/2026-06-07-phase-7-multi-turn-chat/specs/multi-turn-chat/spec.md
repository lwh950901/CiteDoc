## multi-turn-chat

多轮对话支持——后端接收对话历史并拼入 LLM 上下文，前端维护消息数组并渲染对话气泡。

### Requirements

#### 1. 后端 History 支持
- `POST /api/chat` 请求体 MUST 支持可选 `history` 字段：`Array<{ role: 'user' | 'assistant'; content: string }>`
- 历史消息 MUST 拼接到 LLM messages 数组中，位于 system prompt 之后、当前 userMessage 之前
- 仅保留最近 10 条历史消息（5 轮对话），防止 token 超限
- 历史消息不包含检索到的文档片段原文，仅保留 user/assistant 的纯文本
- 每次请求时重新检索文档片段作为新鲜上下文

#### 2. 前端消息数组
- ChatPanel MUST 维护 `messages: Array<{ role: 'user' | 'assistant'; content: string; sources?: Source[] }>` 状态
- 发送问题时 MUST 追加 user 消息到数组，并将所有历史消息作为 `history` 传入 API
- AI 回答流式完成后 MUST 追加 assistant 消息到数组（含 sources）
- 渲染对话气泡：user 右对齐蓝底，assistant 左对齐灰底，角标保持可点击

#### 3. 中断处理
- 如果在流式回答中途发送新问题，MUST 中断当前请求（AbortController）
- 中断后当前未完成的回答不追加到消息数组
- 新请求携带之前完整的历史对话（不含被中断的半条回答）

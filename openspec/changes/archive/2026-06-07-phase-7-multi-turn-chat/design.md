## Design

### 1. 多轮对话

#### 1.1 后端 History 转发

**数据流**:
```
ChatPanel (messages[]) → POST /api/chat { documentId, question, history }
  → route.ts: 取最近 10 条 → 拼入 LLM messages
  → completion.choices[0].message.content → SSE 流
  → ChatPanel: 追加 assistant 消息
```

**API 请求格式**:
```json
{
  "documentId": "uuid",
  "question": "用户当前问题",
  "history": [
    { "role": "user", "content": "之前的问题" },
    { "role": "assistant", "content": "之前的回答" }
  ]
}
```

**LLM Messages 构建**:
```ts
const recentHistory = (history || []).slice(-10);
const messages = [
  { role: "system", content: systemPrompt },
  ...recentHistory,
  { role: "user", content: userMessage },
];
```

关键设计决策：
- history 中不附带文档片段（每次请求重新检索），确保追问也能获取新鲜上下文
- 截断策略：`slice(-10)` 保留最近 5 轮，O(1) 截断

#### 1.2 前端消息数组

**状态结构**:
```ts
interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];  // 仅 assistant 消息
}
const [messages, setMessages] = useState<Message[]>([]);
```

**发送流程**:
1. 用户点击发送 → 追加 `{ role: "user", content: question }`
2. 构建 history: `messages.filter(m => m.role === "user" || m.role === "assistant").map(({role,content}) => ({role,content}))`
3. 发起 SSE 请求
4. 流式构建 answer → 追加 `{ role: "assistant", content: answer, sources }`

**渲染**:
- 对话区域: `overflow-y-auto` + `scrollIntoView` 自动滚动
- user 气泡: `ml-auto bg-blue-500 text-white rounded-br-none`
- assistant 气泡: `mr-auto bg-gray-100 rounded-bl-none`，角标可点击

**中断处理**: 流式输出中发送新消息 → `abortRef.current.abort()` → 不追加未完成的 assistant 消息 → 发起新请求

### 2. 错误处理

#### 2.1 API 状态码

| 状态码 | 场景 | 消息示例 |
|--------|------|---------|
| 400 | 参数缺失 | "缺少 documentId 或 question" |
| 404 | 文档不存在 | "文档不存在" |
| 413 | 文件过大 | "文件大小不能超过 10MB" |
| 429 | 限流 | "请求过于频繁，请稍后重试" |
| 500 | 内部错误/Key无效 | "AI 服务配置错误，请联系管理员" |
| 504 | 超时 | "AI 服务响应超时，请稍后重试" |

#### 2.2 组件状态

每个组件统一使用 `type State = "idle" | "loading" | "empty" | "error" | "done"`：

| 状态 | FileUpload | ChatPanel | DocumentViewer |
|------|-----------|-----------|---------------|
| idle | 选择文件 | 输入问题 | — |
| loading | 上传中+进度 | 检索中+spinner | 加载文档中 |
| empty | — | 无文档提示 | 无文档提示 |
| error | 红色提示条 | 红色提示条 | 红色提示条 |
| done | 紧凑成功栏 | 对话气泡 | 文档全文 |

**流式状态**: ChatPanel 新增 `streaming` 子状态（done 之前，answer 正在构建中），显示闪烁光标。

### 3. UX 打磨

#### 3.1 上传进度

```
FileUpload onUploadSuccess(docId) 
  → page.tsx setDocumentId(docId)
  → FileUpload useEffect: 轮询 GET /api/documents/:id/embed (每 1s)
  → 进度条: "正在处理文档... 3/15 块已向量化"
  → 100% → onReady(docId) → page.tsx 解锁问答
```

**轮询终止条件**: `embeddedChunks === totalChunks && totalChunks > 0`

#### 3.2 高亮 3s 淡出

```ts
// page.tsx
useEffect(() => {
  if (!activeChunkId) return;
  const timer = setTimeout(() => setActiveChunkId(null), 3000);
  return () => clearTimeout(timer);
}, [activeChunkId]);
```

#### 3.3 移动端

Tailwind `lg:` 断点（1024px），移动端 < 1024px 时自动上下布局（已实现 `flex-col lg:flex-row`）。768px 以下可选增加 Tab 切换。

#### 3.4 空状态

首页初始: 空状态插画 + "上传你的第一份文档开始提问"（已实现）

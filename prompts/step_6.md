# 第六阶段任务：流式输出与前端溯源交互（双栏 + 角标高亮跳转）

## 任务目标
将上一阶段的非流式问答接口改造为流式响应，前端实现双栏布局（左文档原文 + 右对话流），AI 回答以打字机效果逐字出现，且其中的 `[1]` `[2]` 角标可点击，点击后左侧原文自动滚动到对应位置并高亮显示。完成这一步，你的 MVP 将具备完整的“可溯源文档问答”交互体验，这也是面试时最直观的亮点。

---

## 前置条件
- 第五阶段已完成，`app/api/chat/route.ts` 能返回 `{ answer, sources }`
- 数据库中有已向量化的文档，`documents.content` 包含原文全文
- 前端基础框架为 Next.js 14+ App Router，已使用 Tailwind CSS

---

## 核心设计决策
1. **“先完整生成，后流式推送”策略**  
   因为答案中的 `[数字]` 标记可能分散在整个回答中，流式状态下未完成的引用无法解析，极易出现闪烁或错误。因此我们在后端先调一次非流式 LLM，拿到完整答案并解析出 sources，然后将答案文本拆成 token 流式发送给前端，同时通过一条自定义 SSE 事件提前发送 sources 元数据。  
2. **前端使用 EventSource 手动解析 SSE**  
   不使用 `useChat` 默认实现，因为我们有自定义事件。改为手动 fetch + ReadableStream 解析 SSE，更灵活地处理 `sources` 事件和 `text` 事件。  
3. **原文渲染为带 id 的 span**  
   为了支持精准滚动高亮，原文全文需按 chunk 的 `charStart`/`charEnd` 切分成多个 `<span>`，每个 span 的 `id` 为 `chunk-{chunkId}`。高亮时通过 `scrollIntoView` 和动态类名实现。  
4. **响应式双栏**  
   桌面端左右并排，移动端上下堆叠（对话在上，原文在下），确保移动端可用。

---

## 任务拆解

### 1. 改造后端问答接口为流式 SSE
**文件**: `app/api/chat/route.ts`

需要将原来的 `POST` 返回 JSON 改为 `ReadableStream` 的 SSE 响应。

**改造步骤**：

- 保留 `retrieveChunks` 和 `buildQAPrompt` 调用。
- 调用 LLM（非流式）获得完整答案和 sources。
- 构造 SSE 流：先发送 `sources` 事件，再逐 token 发送 `text` 事件，最后发送 `done` 事件。

**关键代码骨架**（复制给 Claude Code 让其按此实现）：

```ts
import { NextRequest } from 'next/server';
import { retrieveChunks } from '@/lib/retriever';
import { buildQAPrompt } from '@/lib/prompt';
import OpenAI from 'openai';

const llmClient = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_BASE_URL,
});

export async function POST(req: NextRequest) {
  const { documentId, question } = await req.json();
  // 校验省略...

  // 1. 检索
  const retrieved = await retrieveChunks(question, documentId, 4);
  if (retrieved.length === 0) {
    // 返回流式错误提示
    return new Response(streamNoResult(), { headers: { 'Content-Type': 'text/event-stream' } });
  }

  // 2. 构建 Prompt 并调用 LLM（非流式）
  const { systemPrompt, userMessage } = buildQAPrompt(question, retrieved);
  const completion = await llmClient.chat.completions.create({
    model: process.env.LLM_MODEL || 'deepseek-v4-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.3,
  });
  const rawAnswer = completion.choices[0]?.message?.content || '无法获取回答。';

  // 3. 解析 sources
  const sources = parseReferences(rawAnswer, retrieved);

  // 4. 创建 SSE 流
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // 事件1: 发送溯源元数据
      controller.enqueue(encoder.encode(`event: sources\ndata: ${JSON.stringify(sources)}\n\n`));
      // 事件2: 逐字发送答案文本
      for (const char of rawAnswer) {
        controller.enqueue(encoder.encode(`event: text\ndata: ${JSON.stringify(char)}\n\n`));
      }
      // 事件3: 结束
      controller.enqueue(encoder.encode(`event: done\ndata: [DONE]\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

> 如果要更平滑的流式效果，可在字符间加微小延迟（`await sleep(30)`），但注意会延长响应时间。

### 2. 创建前端问答面板组件
**文件**: `components/ChatPanel.tsx`

核心逻辑：接收 `documentId`，维护对话历史，发送提问并处理 SSE 流，管理 answer 状态和 sources。

**关键点**：
- 使用 `AbortController` 允许用户中断回答。
- 监听 SSE 事件：`sources` → 保存到 state，`text` → 追加到当前 answer，`done` → 结束。
- 将回答中的 `[1]` `[2]` 标记解析为可点击的 `<sup>` 标签。
- 点击角标时调用父组件传入的回调 `onSourceClick(source)`。

**组件结构示例**：
```tsx
'use client';
import { useState, useRef } from 'react';

interface ChatPanelProps {
  documentId: string;
  onSourceClick: (source: any) => void;
}

export default function ChatPanel({ documentId, onSourceClick }: ChatPanelProps) {
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<string[]>([]); // 支持多轮，目前单轮即可
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 发起提问
  async function handleAsk() {
    // 1. 创建 AbortController，fetch 请求，处理 SSE 流
    // 2. 读取流，根据 event.type 处理 'sources', 'text', 'done'
    // 3. 更新状态，最后结束 loading
  }

  // 渲染答案：将文本中的 [数字] 替换为 <sup> 标签，绑定点击事件
  function renderAnswer(text: string) {
    // 正则匹配 \[(\d+)\]，替换为 <sup className="cursor-pointer text-blue-600" onClick={() => 找到对应 source 并调用 onSourceClick}>
  }

  return (
    // 布局：输入框 + 按钮，加载中显示光标，答案气泡，角标可点
  );
}
```

### 3. 创建原文查看器组件
**文件**: `components/DocumentViewer.tsx`

接收 `documentId`，获取原文 `content` 和 `chunks` 列表，渲染带 `id` 的 `<span>` 标签，并暴露 `highlightChunk(chunkId)` 方法或直接响应 props 中的激活 chunkId。

**关键实现**：
- 获取原文和 chunks：调用 `GET /api/documents/:id` 和 `GET /api/documents/:id/chunks`（第三阶段建的那个接口）。
- 渲染逻辑：将原文按 chunks 的 `charStart/charEnd` 切片，每个切片包裹 `<span id="chunk-{chunkId}" className="transition-colors duration-300">...</span>`。
- 高亮控制：接收 `activeChunkId` prop，当变化时：
  - 移除所有 span 的高亮背景（如 `bg-yellow-200`）。
  - 给对应 chunk 添加高亮 class。
  - 调用 `document.getElementById('chunk-xxx')?.scrollIntoView({ behavior: 'smooth', block: 'center' })`。

```tsx
'use client';
import { useEffect, useState } from 'react';

interface DocumentViewerProps {
  documentId: string;
  activeChunkId: string | null;
  onChunkRendered?: () => void;
}

export default function DocumentViewer({ documentId, activeChunkId }: DocumentViewerProps) {
  const [fullText, setFullText] = useState('');
  const [chunks, setChunks] = useState<any[]>([]);

  // 加载原文和 chunks
  useEffect(() => {
    // fetch /api/documents/:id 获取 content
    // fetch /api/documents/:id/chunks 获取 chunk 列表（含 metadata）
  }, [documentId]);

  // 高亮激活的 chunk
  useEffect(() => {
    if (activeChunkId) {
      // 滚动到对应 span，添加高亮类（需要 DOM 操作，可用 ref 或状态驱动）
    }
  }, [activeChunkId]);

  // 将原文按 chunks 切分渲染
  function renderTextWithChunks() {
    // 如果没有 chunks 数据，直接渲染全文
    // 否则按 charStart/charEnd 分段生成 span
  }

  return (
    <div className="h-full overflow-y-auto p-4 border rounded-lg bg-white">
      {renderTextWithChunks()}
    </div>
  );
}
```

### 4. 组装主页面（双栏布局）
**文件**: `app/page.tsx`（或 `app/[docId]/page.tsx`）

使用 Tailwind 的 `flex` 和响应式类实现桌面端左右排布：
- 左侧：`DocumentViewer`（宽度约占 40%-50%）
- 右侧：`ChatPanel`（剩余宽度）
- 移动端：`flex-col`，上方为 ChatPanel，下方为 DocumentViewer。

**状态提升**：
- 在页面组件中定义 `activeChunkId` 状态。
- ChatPanel 中角标点击时，调用 `setActiveChunkId(source.chunkId)` 并传入 DocumentViewer。
- 确保 `chunkId` 可以从 sources 中推导：在 sources 解析时，除了 page 和偏移，还需要包含 `chunkId`。第五阶段的 `sources` 中没有 `chunkId`，现在需要补充。

**改造来源解析**：在 `app/api/chat/route.ts` 的 `parseReferences` 中，将 `retrieved` 数组中的 `id`（即 chunk 的数据库 ID）作为 `chunkId` 写入 source 对象。前端渲染角标时使用这个 `chunkId` 传给 DocumentViewer。

### 5. 补充：为 sources 添加 chunkId
修改 `parseReferences` 函数（第五阶段已定义在 route.ts），在返回的 source 对象中加入 `chunkId: retrieved[ref-1].id`。

### 6. 测试与验证流程
1. 上传文档 → 向量化 → 进入问答页（左右双栏）。
2. 输入问题，点击发送，右侧对话区逐字显示答案，同时左侧原文静默。
3. 答案中出现蓝色角标 `[1]`，点击后左侧原文自动滚动到对应段落，并高亮显示，颜色持续数秒后消失（或保持高亮直到下次点击）。
4. 多次点击不同角标，左侧都能准确定位。
5. 移动端宽度下，布局自动变为上下结构，角标点击仍然有效。
6. 加载中状态（按钮禁用、输入框锁、打字动画）、无结果、错误等边界情况均已处理。

---

## 验收检查清单
- [ ] 问答接口改为 SSE 流式返回，浏览器 Network 面板可见 `text/event-stream`
- [ ] 前端能逐字显示答案，无明显卡顿
- [ ] sources 数据能正确传递到前端，答案中的角标数量与 sources 一致
- [ ] 角标点击能触发左侧原文滚动，且高亮段落正确（内容与答案引用匹配）
- [ ] 双栏布局在桌面端正常，移动端切换为上下布局
- [ ] 无相关答案时，前端显示“未找到相关信息”，无角标
- [ ] 用户中断请求（如快速切换问题），流能正确终止，无状态残留
- [ ] 原文渲染性能可接受（几千字符内无明显延迟）

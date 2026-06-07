## Design

### 1. LLM 超时

**方案**: OpenAI SDK 通过第二个参数 `{ timeout }` 配置超时（毫秒）。客户端使用 `setTimeout + AbortController`。

```ts
// 服务端
const completion = await getLLMClient().chat.completions.create(
  { model: ..., messages: [...], temperature: 0.3 },
  { timeout: 30_000 }
);

// 客户端
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30_000);
// ... fetch, 所有退出路径调用 clearTimeout(timeoutId)
```

### 2. Typewriter Timer 清理

**方案**: `useEffect` cleanup：

```tsx
useEffect(() => {
  return () => {
    if (typewriterTimerRef.current) {
      clearInterval(typewriterTimerRef.current);
    }
  };
}, []);
```

### 3. Chunks 错误处理

**方案**: `!chunksRes.ok` 分支添加 `console.error`，chunks 保持空数组使溯源降级。

### 4. SSE Headers & Response Helper

**方案**: 提取常量和工厂函数，替换 5 处重复代码。

```ts
const SSE_HEADERS = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } as const;
function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, { headers: SSE_HEADERS });
}
```

### 5. Source 接口共享

**方案**: 新建 `lib/types.ts`，route.ts 和 ChatPanel.tsx 统一导入。

### 6. useMemo 优化

- DocumentViewer: `const sortedChunks = useMemo(() => [...chunks].sort(...), [chunks])`
- ChatPanel: `const renderedAnswer = useMemo(() => renderAnswer(answer), [answer, sources])`

### 7. 动态文档 ID

**方案**: 状态提升模式。

```
FileUpload (onUploadSuccess) → page.tsx (useState documentId) → DocumentViewer + ChatPanel
```

- `page.tsx`: `useState<string | null>(null)` 替代 `TEST_DOC_ID`
- `useEffect` 调 `GET /api/documents` 在页面加载时自动获取最近文档
- 无文档时显示空状态提示
- 新增 `POST /api/documents` 端点支持补生成 embedding

### 8. 上传时自动向量化

**方案**: upload API 中 chunks 插入后异步调用 `embedChunks(doc.id)`。

- 使用 `.then().catch()` 模式，不阻塞上传 HTTP 响应
- embedding 进度通过 server console.log 输出
- 为已有文档提供 `POST /api/documents` 补生成入口

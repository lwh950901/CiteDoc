## 1. P0: LLM API 超时

- [x] 1.1 `app/api/chat/route.ts`: chat.completions.create() 添加 `{ timeout: 30000 }`
- [x] 1.2 `components/ChatPanel.tsx`: fetch AbortController 添加 30s 超时 + clearTimeout

## 2. P1: Typewriter Timer 清理

- [x] 2.1 `components/ChatPanel.tsx`: 添加 useEffect cleanup 清除 typewriterTimerRef

## 3. P1: Chunks API 错误处理

- [x] 3.1 `components/DocumentViewer.tsx`: chunksRes 非 ok 时输出 console.error

## 4. P2: SSE Headers 去重

- [x] 4.1 `app/api/chat/route.ts`: 提取 SSE_HEADERS 常量和 sseResponse() helper
- [x] 4.2 替换 5 处重复的 Response headers 为 sseResponse() 调用

## 5. P2: Source 接口共享

- [x] 5.1 新建 `lib/types.ts`，导出 `Source` 接口
- [x] 5.2 `app/api/chat/route.ts`: 从 lib/types.ts 导入 Source
- [x] 5.3 `components/ChatPanel.tsx`: 从 lib/types.ts 导入 Source

## 6. P2: useMemo 性能优化

- [x] 6.1 `components/DocumentViewer.tsx`: sorted chunks 使用 useMemo
- [x] 6.2 `components/ChatPanel.tsx`: renderAnswer 使用 useMemo

## 7. P0: 动态文档 ID（review 发现 #5）

- [x] 7.1 `app/page.tsx`: TEST_DOC_ID 替换为 useState<string | null>，新增 handleUploadSuccess
- [x] 7.2 `components/FileUpload.tsx`: 新增 onUploadSuccess prop，上传成功后回调
- [x] 7.3 无文档时显示空状态提示
- [x] 7.4 新建 `GET /api/documents` 返回最近上传的文档

## 8. P0: 上传时自动向量化（review 发现 #6）

- [x] 8.1 `app/api/upload/route.ts`: 导入 embedChunks，插入 chunks 后异步调用
- [x] 8.2 新建 `POST /api/documents` 补生成 embedding
- [x] 8.3 为已有文档补充运行 embedChunks

## 9. 验证

- [x] 9.1 `npx tsc --noEmit` TypeScript 编译通过
- [x] 9.2 浏览器测试：页面加载自动显示最近文档
- [x] 9.3 浏览器测试：上传新文件后文档原文切换
- [x] 9.4 浏览器测试：打字机流式效果 + 溯源高亮正常
- [x] 9.5 curl 测试：POST /api/documents 补生成 embedding 正常
- [x] 9.6 验证无控制台错误

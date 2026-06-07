## code-quality-fixes

Phase 5-6 code review 发现的代码质量问题的修复规格。

### Requirements

#### 1. LLM API 超时
- `POST /api/chat` 中的 LLM 调用 MUST 在 30 秒后超时，返回 SSE error 事件
- 客户端 fetch MUST 在 AbortController 上设置 30 秒超时，超时后显示错误提示
- 所有清理路径（done/error/early-return/catch）MUST 调用 `clearTimeout`

#### 2. Typewriter Timer 清理
- ChatPanel 组件卸载时 MUST 清除 `setInterval` 计时器
- 清理逻辑 MUST 通过 `useEffect` cleanup function 实现

#### 3. Chunks API 错误处理
- DocumentViewer 在 `/api/documents/:id/chunks` 返回非 ok 时 MUST 输出 console.error
- 溯源功能在 chunks 数据不可用时应优雅降级（不显示错误，但关闭溯源交互）

#### 4. SSE Headers 去重
- `"Content-Type": "text/event-stream"` 及相关 headers MUST 提取为模块级常量 `SSE_HEADERS`
- 新增 `sseResponse()` helper 函数统一创建 SSE Response
- 所有 5 处 Response 构造 MUST 替换为 `sseResponse()`

#### 5. Source 接口共享
- Source 接口 MUST 从 route.ts 和 ChatPanel.tsx 提取到 `lib/types.ts`
- 两端 MUST 从同一源 `import type { Source } from "@/lib/types"` 导入

#### 6. useMemo 性能优化
- DocumentViewer 的 sorted chunks MUST 使用 `useMemo` 缓存
- ChatPanel 的 `renderAnswer` 结果 SHOULD 使用 `useMemo` 缓存

#### 7. 动态文档 ID（新增）
- `page.tsx` MUST 使用 `useState<string | null>` 管理当前文档 ID
- `FileUpload` MUST 通过 `onUploadSuccess` 回调将新文档 ID 传递回 `page.tsx`
- `DocumentViewer` 和 `ChatPanel` MUST 使用动态 `documentId` 而非硬编码 TEST_DOC_ID
- 无文档时 MUST 显示 "请先上传一个 PDF 或 DOCX 文档" 空状态提示
- 页面加载时 MUST 通过 `GET /api/documents` 自动获取最近上传的文档

#### 8. 上传时自动向量化（新增）
- `POST /api/upload` 在插入 chunks 后 MUST 调用 `embedChunks(doc.id)` 生成向量嵌入
- embedding 生成 MUST 异步执行，不阻塞上传响应
- 日志 MUST 记录 embedding 成功/失败计数
- `POST /api/documents` 端点 MUST 支持为已有文档补生成 embedding

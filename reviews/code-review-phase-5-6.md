# Phase 5 + Phase 6 Code Review

**审查范围**: Phase 5 (7d476b9) + Phase 6 (working tree + 新文件)  
**审查人**: AI Code Review (9-angle exhaustive scan)  
**日期**: 2026-06-07  
**最后更新**: 2026-06-07 (修复验证完成)  
**审查标准**: role.md 全栈前端工程师规范

---

## 审查摘要

| 严重度 | 发现 | 已修复 | 待处理 |
|--------|------|--------|--------|
| 🔴 高 | 1 | 1 | 0 |
| 🟡 中 | 6 | 6 | 0 |
| 🟢 低 | 7 | 5 | 2 |
| **总计** | **14** | **12** | **2** |

---

## 🔴 高严重度

### 1. [route.ts:128-135] LLM API 调用无超时 → 请求永久挂起 ✅ 已修复

**文件**: `app/api/chat/route.ts`

**修复内容**:
- 服务端: `chat.completions.create()` 添加 `{ timeout: 30000 }` 选项
- 客户端: fetch 添加 `setTimeout(() => controller.abort(), 30000)` 超时机制
- 所有清理路径 (done/error/early-return/catch) 均调用 `clearTimeout(timeoutId)`

---

## 🟡 中严重度

### 2. [ChatPanel.tsx:38-53] setInterval 计时器未在组件卸载时清理 ✅ 已修复

**文件**: `components/ChatPanel.tsx`

**修复内容**: 添加 `useEffect` cleanup 函数，组件卸载时 `clearInterval(typewriterTimerRef.current)`

### 3. [DocumentViewer.tsx:71-74] chunks API 错误被静默忽略 ✅ 已修复

**文件**: `components/DocumentViewer.tsx`

**修复内容**: `chunksRes` 非 ok 时输出 `console.error("Failed to load chunks:", chunksRes.status)`

### 4. [route.ts:172-182] Error 类型断言不够安全 ✅ 已修复

**文件**: `app/api/chat/route.ts`

**修复内容**: `(apiErr.error as Record<string, string>).message` → 先取 `unknown` 再 `typeof` 检查为 `string`

### 5. [page.tsx:10] 硬编码 TEST_DOC_ID → 上传新文件后文档不切换 ✅ 已修复

**文件**: `app/page.tsx`, `components/FileUpload.tsx`

**问题**: `const TEST_DOC_ID = "..."` 硬编码，上传新文档后 DocumentViewer/ChatPanel 仍指向旧文档。

**修复内容**:
- `page.tsx`: `useState<string | null>(null)` 动态管理 `documentId`，`useEffect` 自动加载最近文档
- `FileUpload.tsx`: 新增 `onUploadSuccess(docId)` prop，上传成功后回调更新 `documentId`
- 无文档时显示 "请先上传一个 PDF 或 DOCX 文档" 提示
- 新增 `GET /api/documents` 返回最近文档（含向量化状态）
- 新增 `POST /api/documents` 支持为已有文档补生成 embedding

### 6. [upload/route.ts:96] 上传时不生成 embedding → 新文档问答返回空 ✅ 已修复

**文件**: `app/api/upload/route.ts`

**问题**: 上传 API 中 chunks 插入时注释写死 `// embedding 暂不生成，留给 Phase 4 向量化`，导致新文档无向量，检索返回空。

**修复内容**:
- 导入 `embedChunks`，插入 chunks 后异步调用 `embedChunks(doc.id)` 生成向量嵌入
- 异步执行不阻塞上传响应
- 日志记录 embedding 成功/失败计数

---

## 🟢 低严重度

### 7. [route.ts] SSE Headers 重复 5 次 ✅ 已修复

**修复内容**: 提取 `SSE_HEADERS` 常量和 `sseResponse()` helper，5 处替换为 `sseResponse(stream)`

### 8. Source 接口在前后端重复定义 ✅ 已修复

**文件**: `lib/types.ts` (新建), `app/api/chat/route.ts`, `components/ChatPanel.tsx`

**修复内容**: Source 接口提取到 `lib/types.ts`，前后端统一导入 `import type { Source } from "@/lib/types"`

### 9. [DocumentViewer.tsx:131] 每次渲染都重新排序 chunks ✅ 已修复

**修复内容**: `const sortedChunks = useMemo(() => [...chunks].sort(...), [chunks])`

### 10. [ChatPanel.tsx:178] renderAnswer 在每次打字机 tick 执行正则 ✅ 已修复

**修复内容**: `const renderedAnswer = useMemo(() => renderAnswer(answer), [answer, sources])`

### 11. [ChatPanel.tsx:285+] 组件超过 200 行限制

**文件**: `components/ChatPanel.tsx`

**问题**: `role.md` 第 8 条规范要求组件不超过 200 行，当前约 330 行。**待后续重构**。

### 12. [ChatPanel.tsx:69] handleAsk 在每次按键时重建

**问题**: `useCallback` 依赖 `question`，每次按键重建函数引用。**性能影响极小，可后续优化**。

---

## 架构层面观察

### 1. 流式架构: "先完整生成，后流式推送"

当前设计：LLM 调用是非流式的（`stream: false`），等完整响应后再通过 SSE 逐字推送到前端。

**优点**: 引用解析在完整文本上执行，准确率更高。  
**缺点**: TTFB 高，用户需等待完整 LLM 响应（2-5 秒）才能看到第一个字。  
**后续方向**: Phase 7+ 改为真流式 LLM 调用 + 增量引用解析。

### 2. 无对话历史

ChatPanel 每次提问替换上一次的回答，不保留对话历史。当前实现符合 MVP 范围。

### 3. Edge Runtime 已移除

Phase 4 的 `export const runtime = "edge"` 在 Phase 5 移除。pgvector 需要 Node.js runtime，合理。

---

## 验证通过的项 ✓

- ✅ 无 XSS 风险 — React 默认转义文本内容
- ✅ 无 SQL 注入 — Drizzle ORM 参数化查询
- ✅ TypeScript strict mode 0 errors
- ✅ SSE 事件边界正确（`\n\n` 分隔，`event:`/`data:` 格式）
- ✅ `params` 在 Next.js 15 中正确 await
- ✅ 错误状态覆盖: idle / loading / done / error 四种状态
- ✅ DocumentViewer 高亮动画 CSS `forwards` fill 正确
- ✅ FileUpload 紧凑模式 + reset 逻辑正确
- ✅ 打字机逐字流式效果正常
- ✅ 引用角标点击 → 文档原文高亮跳转正常
- ✅ 上传新文件后文档原文自动切换
- ✅ 新文档 embedding 自动生成，问答检索正常
- ✅ LLM 超时 (30s 服务端 + 30s 客户端)
- ✅ Typewriter timer 组件卸载时清理

---

## 修复文件清单

| 文件 | 修改内容 |
|------|---------|
| `app/api/chat/route.ts` | LLM 30s 超时、SSE_HEADERS + sseResponse()、Source 共享导入、error 类型安全 |
| `app/api/upload/route.ts` | 导入 embedChunks，上传后异步生成向量嵌入 |
| `app/api/documents/route.ts` **(新)** | GET 返回最近文档+向量化状态，POST 补生成 embedding |
| `app/api/documents/[id]/route.ts` | 已有，无需改动 |
| `app/page.tsx` | 动态 documentId、自动加载最近文档、onUploadSuccess 联动 |
| `components/ChatPanel.tsx` | fetch 30s 超时、useEffect timer 清理、Source 共享导入、renderAnswer useMemo |
| `components/DocumentViewer.tsx` | chunks 错误 console.error、sortedChunks useMemo |
| `components/FileUpload.tsx` | 新增 onUploadSuccess prop |
| `lib/types.ts` **(新)** | 共享 Source 接口 |

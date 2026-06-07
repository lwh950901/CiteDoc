## review-fixes-phase-7

Phase 7 code review (reviews/code-review-phase-7.md) 发现的 3 个中等问题的修复规格。

### Requirements

#### 1. DocUploadPanel 文件前置校验
- 客户端 MUST 在 `handleFile` 中校验 MIME 类型：仅允许 `application/pdf` 和 `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- 类型不符 MUST 即时显示 "仅支持 PDF 和 DOCX 文件"，不发起 API 请求
- 文件大小超过 10MB MUST 即时显示 "文件不能超过 10MB"，不发起 API 请求

#### 2. FileUpload 死代码清理
- `components/FileUpload.tsx` MUST 从代码库删除（已被 DocUploadPanel + DocumentViewer 替代，无任何引用）

#### 3. ChatPanel history 捕获健壮性
- 已完成对话历史 MUST 通过 `useRef`（`completedHistoryRef`）维护，不依赖 `setMessages` 函数式更新的批处理时序
- user 消息发送时 MUST 同步追加到 `completedHistoryRef`
- assistant 回答流式完成后 MUST 同步追加到 `completedHistoryRef`
- `handleAsk` 构建 API `history` 参数时 MUST 从 ref 读取（`.slice()`），不通过 state 捕获

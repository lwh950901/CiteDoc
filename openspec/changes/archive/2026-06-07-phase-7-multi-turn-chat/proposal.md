## Why

当前系统仅支持单轮问答（每次提问替换上一次回答），无法结合上文进行追问。此外，全流程错误处理不够完善——部分场景缺少 loading/empty/error 状态覆盖，快速操作（连续点击、刷新、中断）可能导致异常。Phase 7 将系统从"功能可用"提升到"产品体验完整"，面试演示时经得起各种操作。

## What Changes

- **多轮对话**: 后端接收 `history` 参数并拼入 LLM messages；前端维护消息数组（user/assistant 气泡），对话历史保留最近 5 轮
- **API 错误规范化**: 所有端点统一状态码（400/404/413/429/500/504），区分超时和认证错误
- **前端状态全覆盖**: 每个组件覆盖 idle/loading/empty/error/streaming/no-result 六种状态
- **上传进度可视化**: 向量化进度条（轮询 `/api/documents/:id/embed`），完成前禁用提问
- **UX 打磨**: Enter 发送/Shift+Enter 换行、自动滚动、高亮 3s 淡出、移动端适配、空状态引导

## Capabilities

### New Capabilities
- `multi-turn-chat`: 多轮对话——后端 history 转发、前端消息气泡、上下文维持
- `error-handling`: 全流程错误处理与状态覆盖——API 状态码规范、组件六状态、边界场景保护
- `ux-polish`: 用户体验打磨——上传进度条、键盘交互、自动滚动、高亮淡出、移动端适配

### Modified Capabilities
- `qa-api`: SSE 请求新增可选 `history` 字段；错误响应格式规范化
- `qa-ui`: ChatPanel 从单答案改为多轮消息气泡；新增 streaming/empty/no-result 状态
- `file-upload-ui`: 新增向量化进度条和提问禁用逻辑

## Impact

- **API 变更**: `POST /api/chat` 新增可选 `history` 字段；错误 SSE 事件增强
- **组件重构**: ChatPanel 从单答案模式改为消息列表模式；FileUpload 增加进度轮询
- **新增依赖**: 无
- **Breaking**: 无——`history` 为可选字段，现有调用方不受影响

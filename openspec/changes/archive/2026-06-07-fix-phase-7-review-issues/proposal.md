## Why

Phase 7 code review 发现 3 个中等问题（M-1: DocUploadPanel 缺文件校验、M-2: FileUpload 死代码、M-3: history 捕获依赖批处理时序），已在 `reviews/code-review-phase-7.md` 中记录。均影响代码质量和健壮性，需在归档 Phase 7 前修复。

## What Changes

- **DocUploadPanel 文件校验**: 添加客户端 MIME 类型和文件大小即时校验
- **删除 FileUpload 死代码**: 移除无引用的 `components/FileUpload.tsx`
- **ChatPanel history 健壮化**: 从 `setMessages`+`setTimeout(0)` 改为 `completedHistoryRef` 维护对话历史

## Capabilities

### New Capabilities
- `review-fixes-phase-7`: Phase 7 code review 发现问题的修复——文件校验、死代码清理、history 捕获健壮性

### Modified Capabilities
<!-- (none — 实现层面修复，不改变功能规格) -->

## Impact

- `app/page.tsx`: DocUploadPanel 增加前置校验
- `components/FileUpload.tsx`: 删除
- `components/ChatPanel.tsx`: history 捕获改为 ref
- `reviews/code-review-phase-7.md`: 标记 3 项为已修复

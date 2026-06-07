## Why

Phase 6 流式问答已实现核心功能，但前端存在 3 个影响体验的 P0 问题：
1. 上传成功后上传区域仍占满屏 200px+，浪费宝贵空间
2. 打字机效果每字符触发一次 setState，500 字答案 = 500 次渲染
3. 文档原文是连续文本墙，无页面/段落视觉层级，用户无法快速定位

这些问题在面试展示时直接影响第一印象。

## What Changes

- FileUpload 上传成功后收缩为紧凑状态栏（一行显示文件名 + 换文件按钮）
- ChatPanel 打字机渲染改为批量追加模式（每 30ms 批量提交，减少渲染次数）
- DocumentViewer 在 chunk page 变化处插入页面分隔标记（`—— 第 N 页 ——`）

## Capabilities

### New Capabilities

<!-- 无新增 capability，均为现有能力的优化 -->

### Modified Capabilities

- `file-upload-ui`: 上传成功后收缩为紧凑状态栏，释放垂直空间
- `chat-panel`: 打字机渲染从逐字 setState 改为批量追加（性能优化）
- `document-viewer`: 文档原文增加页面分隔标记，增强视觉层级

## Impact

- `components/FileUpload.tsx`: 新增 compact 模式渲染
- `components/ChatPanel.tsx`: SSE text 事件处理增加 batch buffer
- `components/DocumentViewer.tsx`: renderTextWithChunks 增加 page 边界检测

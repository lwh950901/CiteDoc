## 1. FileUpload 紧凑模式

- [x] 1.1 上传成功后渲染紧凑状态栏（一行：✅文件名 + 页数/段落数 + 换文件按钮）
- [x] 1.2 compact 模式高度不超过 40px，释放上传区域占用的垂直空间

## 2. ChatPanel 批量渲染

- [x] 2.1 SSE text 事件处理改为 batch buffer 模式（每 30ms 或 10 字符 flush）
- [x] 2.2 done 事件时立即 flush 剩余 buffer

## 3. DocumentViewer 页面分隔 + 高亮动画

- [x] 3.1 renderTextWithChunks 在 chunk page 变化处插入页面分隔标记
- [x] 3.2 高亮效果从瞬时 classList.add 改为 CSS 动画（highlight-pulse，2s 淡出）

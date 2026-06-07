## MODIFIED Requirements

### Requirement: Document text chunked rendering

DocumentViewer 组件 SHALL 获取文档原文和 chunk 列表，将原文按 chunks 的 `charStart`/`charEnd` 切分为多个 `<span id="chunk-{chunkId}">`。当连续两个 chunk 的 `page` 元数据不同时，SHALL 在它们之间插入页面分隔标记 `—— 第 N 页 ——`。

#### Scenario: Page separators between chunks

- **WHEN** 文档有 3 个 page，chunks 按 page 分组
- **THEN** page 1 和 page 2 的 chunk 之间渲染 `<div className="text-xs text-gray-300 text-center my-3">—— 第 2 页 ——</div>`
- **AND** 分隔标记不可选中、不参与高亮

#### Scenario: Single page document no separator

- **WHEN** 文档只有 1 页，所有 chunks 的 page 相同
- **THEN** 不渲染任何页面分隔标记

### Requirement: Chunk highlight and scroll-to on activation

DocumentViewer SHALL 接收 `activeChunkId` prop，当该值变化时，移除旧 chunk 的高亮样式，为新 chunk 添加高亮样式并调用 `scrollIntoView({ behavior: 'smooth', block: 'center' })` 滚动到可见区域。高亮效果 SHALL 使用 CSS 动画实现淡入淡出（`highlight-pulse`），避免瞬时高亮的生硬感。

#### Scenario: Highlight with fade animation

- **WHEN** `activeChunkId` 从 `null` 变为 `"c1"`
- **THEN** `#chunk-c1` 元素触发 CSS `highlight-pulse` 动画（背景色从黄色渐变到透明，持续 2s）
- **AND** `#chunk-c1` 滚动到视口中央

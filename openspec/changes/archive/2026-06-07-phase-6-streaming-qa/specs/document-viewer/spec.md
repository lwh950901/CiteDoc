## ADDED Requirements

### Requirement: Document text chunked rendering

DocumentViewer 组件 SHALL 获取文档原文（`GET /api/documents/:id`）和 chunk 列表（`GET /api/documents/:id/chunks`），将原文按 chunks 的 `charStart`/`charEnd` 切分为多个 `<span id="chunk-{chunkId}">`，每个 span 包裹对应区间的文本。

#### Scenario: Text split into chunk spans

- **WHEN** 文档原文为 "ABCDEFGHIJ"，chunks 数据为 `[{ id: "c1", charStart: 0, charEnd: 5 }, { id: "c2", charStart: 5, charEnd: 10 }]`
- **THEN** 渲染 `<span id="chunk-c1">ABCDE</span><span id="chunk-c2">FGHIJ</span>`

#### Scenario: No chunks loaded

- **WHEN** chunk API 返回空数组或加载失败
- **THEN** 原文全文渲染为单个无 id 的 `<div>`，不报错

### Requirement: Chunk highlight and scroll-to on activation

DocumentViewer SHALL 接收 `activeChunkId` prop，当该值变化时，移除旧 chunk 的高亮样式（`bg-yellow-100`），为新 chunk 添加高亮样式并调用 `scrollIntoView({ behavior: 'smooth', block: 'center' })` 滚动到可见区域。

#### Scenario: Highlight and scroll on prop change

- **WHEN** `activeChunkId` 从 `null` 变为 `"c1"`
- **THEN** `#chunk-c1` 元素的 class 添加 `bg-yellow-100`
- **AND** `#chunk-c1` 滚动到视口中央

#### Scenario: Highlight moves to new chunk

- **WHEN** `activeChunkId` 从 `"c1"` 变为 `"c2"`
- **THEN** `#chunk-c1` 移除 `bg-yellow-100`
- **AND** `#chunk-c2` 添加 `bg-yellow-100` 并滚动到视口中央

### Requirement: Scrollable container

DocumentViewer SHALL 提供可滚动的原文容器，固定高度并支持 `overflow-y-auto`，确保长文档在页面中占固定区域。

#### Scenario: Long document scrolls

- **WHEN** 原文内容超过容器高度（如 70vh）
- **THEN** 容器出现垂直滚动条，用户可上下浏览

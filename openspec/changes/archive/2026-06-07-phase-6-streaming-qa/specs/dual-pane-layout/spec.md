## ADDED Requirements

### Requirement: Desktop side-by-side layout

系统 SHALL 在主页面实现桌面端左右双栏布局：左侧为 DocumentViewer，右侧为 ChatPanel。

#### Scenario: Desktop layout

- **WHEN** 视口宽度 ≥ 1024px（lg 断点）
- **THEN** DocumentViewer 占约 45% 宽度，ChatPanel 占剩余宽度
- **AND** 两栏并排显示，各自可独立滚动

### Requirement: Mobile stacked layout

系统 SHALL 在移动端自动切换为上下堆叠布局，对话区在上、原文区在下。

#### Scenario: Mobile layout

- **WHEN** 视口宽度 < 1024px
- **THEN** ChatPanel 占上方，DocumentViewer 占下方
- **AND** 两栏均为 100% 宽度，垂直排列

### Requirement: State coordination via lifted state

主页面 SHALL 管理 `activeChunkId` 状态，将其传递给 ChatPanel（通过 `onSourceClick` 回调设置）和 DocumentViewer（通过 `activeChunkId` prop 响应）。

#### Scenario: Citation click triggers scroll and highlight

- **WHEN** 用户在 ChatPanel 中点击 `[1]` 角标
- **THEN** ChatPanel 调用 `onSourceClick(source)` 
- **AND** 主页面设置 `activeChunkId = source.chunkId`
- **AND** DocumentViewer 响应 prop 变化，滚动到对应 span 并高亮

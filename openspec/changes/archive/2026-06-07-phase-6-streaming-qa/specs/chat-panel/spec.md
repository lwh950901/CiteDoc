## ADDED Requirements

### Requirement: SSE stream parsing and display

ChatPanel 组件 SHALL 使用 `fetch` + `ReadableStream` 手动解析 SSE 流，根据事件类型分别处理 `sources`、`text`、`done`、`error` 事件，以打字机效果逐字显示答案。

#### Scenario: Text appears character by character

- **WHEN** SSE 流逐字符推送 `event: text` 数据
- **THEN** 答案区逐字追加显示，形成打字机效果
- **AND** 输入框在流式接收期间保持 disabled

#### Scenario: Sources received before text

- **WHEN** SSE 流第一个事件为 `event: sources`
- **THEN** 组件将 sources 保存到内部状态，但不立即渲染
- **AND** 后续 text 事件追加到答案区

#### Scenario: Done event closes stream

- **WHEN** 收到 `event: done`
- **THEN** 组件结束 loading 状态，恢复输入框可用

#### Scenario: Error event displays message

- **WHEN** 收到 `event: error`
- **THEN** 组件显示错误提示，结束 loading 状态

### Requirement: Citation marker rendering and click

ChatPanel SHALL 将答案文本中的 `[数字]` 格式引用标记解析为可点击的 `<sup>` 角标标签，点击时调用 `onSourceClick(source)` 回调传递对应的 source 对象。

#### Scenario: Clickable citation superscript

- **WHEN** 答案文本包含 "学习Python应看新版python[1]"
- **THEN** `[1]` 被渲染为蓝色可点击 `<sup>` 标签
- **AND** 点击 `<sup>` 调用 `onSourceClick({ chunkId: "...", page: 2, ... })`

#### Scenario: Multiple citations all clickable

- **WHEN** 答案包含 `[1]` 和 `[2]` 两个角标
- **THEN** 两个 `<sup>` 均可独立点击，分别传递对应 source

### Requirement: Request interruption

ChatPanel SHALL 支持通过 AbortController 中断正在进行的请求，用户关闭页面或发起新问题时旧请求自动中止。

#### Scenario: Abort on new question

- **WHEN** 用户在一个请求尚未完成时输入新问题并提交
- **THEN** 旧请求的 AbortController 被触发，SSE 流读取终止
- **AND** 新请求正常发起

### Requirement: Loading and idle states

ChatPanel SHALL 维护 loading/idle/done/error 四种状态，对应不同的 UI 呈现。

#### Scenario: Loading state UI

- **WHEN** 请求进行中
- **THEN** 发送按钮显示 "⏳ 分析中..." 且 disabled
- **AND** 输入框 disabled
- **AND** 答案区显示闪烁光标表示正在生成

#### Scenario: Idle state UI

- **WHEN** 未发起请求且无历史回答
- **THEN** 显示占位提示 "输入问题后点击发送，AI 将基于文档内容回答"

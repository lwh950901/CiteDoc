## MODIFIED Requirements

### Requirement: Question input and submission

系统 SHALL 在 `ChatPanel` 组件中提供问题输入框和发送按钮，允许用户输入问题并通过 `fetch` + `ReadableStream` 解析 SSE 流式响应。

#### Scenario: User submits a question

- **WHEN** 用户在输入框中输入问题并点击发送按钮
- **THEN** 系统使用 `fetch` 发起 POST 请求到 `/api/chat`，通过 `response.body.getReader()` 读取 SSE 流
- **AND** 按钮在请求期间变为不可点击（loading 状态）
- **AND** 输入框在请求期间 disabled

#### Scenario: Empty question prevention

- **WHEN** 用户输入框为空或仅空白字符时点击发送按钮
- **THEN** 系统不发起 API 请求
- **AND** 按钮保持 disabled 状态

### Requirement: Answer streaming display with citations

系统 SHALL 以打字机效果逐字显示 SSE 流推送的答案文本，并将答案中的 `[数字]` 引用标记渲染为可点击的 `<sup>` 角标标签，点击角标时通知父组件触发原文定位。

#### Scenario: Display streaming answer with citation markers

- **WHEN** SSE 流推送 `sources` 事件后逐字符推送答案 "学习Python应看新版python[1]"
- **THEN** 答案区逐字显示文本，"打字机效果"逐字追加
- **AND** `[1]` 被渲染为蓝色 `<sup>` 标签
- **AND** 点击 `[1]` `<sup>` 时，调用 `onSourceClick(source)` 传入包含 `chunkId` 的 source 对象

#### Scenario: Loading state shows cursor indicator

- **WHEN** SSE 流正在接收 text 事件但尚未完成
- **THEN** 答案区显示闪烁光标 `▍` 或等效动画表示正在生成

#### Scenario: Done state hides cursor

- **WHEN** 收到 SSE `event: done`
- **THEN** 闪烁光标消失，输入框恢复可用，loading 状态结束

#### Scenario: Error state

- **WHEN** 收到 SSE `event: error` 或网络请求失败
- **THEN** 显示错误提示信息，loading 状态结束

### Requirement: Request interruption

ChatPanel SHALL 支持通过 AbortController 中断正在进行的 SSE 请求。

#### Scenario: Interrupt on new request

- **WHEN** 用户在一个请求尚未完成时提交新问题
- **THEN** 旧请求的 AbortController 被触发，SSE 流读取终止
- **AND** 新请求正常发起，无状态残留

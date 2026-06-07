## MODIFIED Requirements

### Requirement: SSE stream parsing and display

ChatPanel 组件 SHALL 使用 `fetch` + `ReadableStream` 手动解析 SSE 流，根据事件类型分别处理 `sources`、`text`、`done`、`error` 事件。`text` 事件 SHALL 采用批量追加模式（每 30ms 或每 10 个字符批量提交一次 setState），减少逐字渲染带来的性能开销。

#### Scenario: Text appears with batched rendering

- **WHEN** SSE 流逐字符推送 `event: text` 数据
- **THEN** 答案区以批量追加方式显示文本（非逐字 setState）
- **AND** 每批最多 30ms 间隔或 10 个字符后 flush
- **AND** 用户感知仍为打字机效果，无明显闪烁

#### Scenario: Sources received before text

- **WHEN** SSE 流第一个事件为 `event: sources`
- **THEN** 组件将 sources 保存到内部状态，但不立即渲染
- **AND** 后续 text 事件批量追加到答案区

#### Scenario: Done event closes stream

- **WHEN** 收到 `event: done`
- **THEN** 组件立即 flush 剩余 buffer，结束 loading 状态

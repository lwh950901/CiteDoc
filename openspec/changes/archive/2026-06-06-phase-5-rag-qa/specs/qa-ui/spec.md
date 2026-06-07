## ADDED Requirements

### Requirement: Question input and submission

系统 SHALL 在 `QAPanel` 组件中提供问题输入框和提交按钮，允许用户输入问题并触发问答流程。

#### Scenario: User submits a question

- **WHEN** 用户在输入框中输入问题并点击"提问"按钮
- **THEN** 系统调用 `POST /api/chat`，传入文档 ID 和问题文本
- **AND** 按钮在请求期间变为不可点击（loading 状态）

#### Scenario: Empty question prevention

- **WHEN** 用户输入框为空时点击"提问"按钮
- **THEN** 系统不发起 API 请求
- **AND** 可通过按钮 disabled 状态或 toast 提示阻止

### Requirement: Answer and sources display

系统 SHALL 展示 LLM 返回的答案文本和 sources 溯源列表，帮助用户验证回答来源。

#### Scenario: Display answer with citations

- **WHEN** API 返回 `{ answer: "...包含[1][2]标记的文本...", sources: [{ id: 1, page: 2, ... }, { id: 2, page: 5, ... }] }`
- **THEN** 答案区展示完整文本（保留 `[1]` `[2]` 标记）
- **AND** 下方 sources 列表展示每条引用：序号、页码、内容摘要

#### Scenario: No sources to display

- **WHEN** API 返回 `{ answer: "...", sources: [] }`
- **THEN** sources 区域显示 "无引用来源" 或隐藏

#### Scenario: Loading state

- **WHEN** API 请求进行中
- **THEN** 答案区显示加载指示器（如 "正在分析文档..."）
- **AND** 之前的内容不被清除（避免闪烁）

#### Scenario: Error state

- **WHEN** API 请求失败（网络错误或服务器 500）
- **THEN** 显示错误提示 "问答请求失败，请稍后重试"

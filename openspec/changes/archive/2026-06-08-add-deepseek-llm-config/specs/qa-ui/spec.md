## ADDED Requirements

### Requirement: LLM readiness gating

系统 SHALL 在渲染问答交互前检测 LLM 配置就绪状态，避免用户在未配置凭据时进入无效提问流程。

#### Scenario: Block chat until LLM ready

- **WHEN** 服务端 env 未配置 LLM
- **AND** 浏览器尚未保存有效的 `docqa-llm-config`
- **THEN** 问答区展示 `LlmConfigPanel` 而非 `ChatPanel`
- **AND** 不展示可提交的问答输入框

#### Scenario: Allow chat when env configured

- **WHEN** `GET /api/llm-config` 返回 `configured: true`
- **THEN** 文档上传并向量化完成后，问答区正常展示 `ChatPanel`
- **AND** 不展示 LLM 配置引导

#### Scenario: Allow chat with client-stored credentials

- **WHEN** 服务端 env 未配置
- **AND** `localStorage` 中存在有效的 `docqa-llm-config`
- **THEN** 问答区展示 `ChatPanel`
- **AND** 提问请求 MUST 在 body 中附带 `llmApiKey` 与 `llmModel`

### Requirement: LLM configuration guidance

系统 SHALL 在配置引导态向用户提供 DeepSeek 注册说明与字段说明，降低首次配置成本。

#### Scenario: Show registration hint

- **WHEN** `LlmConfigPanel` 处于展示状态
- **THEN** 面板包含 DeepSeek 注册/获取 API Key 的说明或外链（https://platform.deepseek.com）
- **AND** 说明 env 配置方式（`.env.local` 中设置 `LLM_API_KEY` 与 `LLM_MODEL`）为可选的本地开发路径

## MODIFIED Requirements

### Requirement: Question input and submission

系统 SHALL 在 `ChatPanel` 组件中提供问题输入框和提交按钮，允许用户输入问题并触发问答流程；当使用客户端 LLM 凭据时，请求 MUST 附带相应字段。

#### Scenario: User submits a question

- **WHEN** 用户在输入框中输入问题并点击"发送"按钮
- **AND** LLM 凭据已通过 env 或 localStorage 就绪
- **THEN** 系统调用 `POST /api/chat`，传入文档 ID、问题文本与对话 history
- **AND** 当服务端 env 未配置时，请求 body MUST 包含 `llmApiKey` 与 `llmModel`
- **AND** 按钮在请求期间变为不可点击（loading 状态）

#### Scenario: Empty question prevention

- **WHEN** 用户输入框为空时点击"发送"按钮
- **THEN** 系统不发起 API 请求
- **AND** 可通过按钮 disabled 状态阻止

### Requirement: Answer and sources display

系统 SHALL 展示 LLM 返回的答案文本和 sources 溯源列表，帮助用户验证回答来源。

#### Scenario: Display answer with citations

- **WHEN** SSE 流返回 `sources` 与 `text` 事件，回答包含 `[1]` `[2]` 标记
- **THEN** 答案区展示完整文本（保留 `[1]` `[2]` 标记）
- **AND** 下方 sources 列表展示每条引用：序号、页码、内容摘要

#### Scenario: No sources to display

- **WHEN** SSE 流中 `sources` 事件为空数组
- **THEN** sources 区域显示 "无引用来源" 或隐藏

#### Scenario: Loading state

- **WHEN** API 请求进行中
- **THEN** 答案区显示加载指示器（如 assistant 气泡中的 "…"）
- **AND** 之前的内容不被清除（避免闪烁）

#### Scenario: Error state

- **WHEN** SSE 流返回 `error` 事件（含凭据缺失或认证失败）
- **THEN** 显示错误提示，内容为 SSE error 消息
- **AND** 若为凭据相关错误，提示用户检查 DeepSeek 配置或重新打开配置面板

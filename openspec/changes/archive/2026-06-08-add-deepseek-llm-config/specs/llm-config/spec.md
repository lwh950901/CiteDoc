## ADDED Requirements

### Requirement: Server-side LLM env detection

系统 SHALL 提供 `GET /api/llm-config` 端点，检测服务端 `LLM_API_KEY` 是否已配置，并返回不含密钥明文的配置状态。

#### Scenario: Env fully configured

- **WHEN** 服务端 `LLM_API_KEY` 非空
- **THEN** 响应为 200，JSON 包含 `{ configured: true, source: "env", model: "<resolved-model>" }`
- **AND** `model` 为 `LLM_MODEL` 环境变量值，缺省时为 `deepseek-chat`
- **AND** 响应中 MUST NOT 包含 `apiKey`、密钥掩码或任何可还原密钥的字段

#### Scenario: Env not configured

- **WHEN** 服务端 `LLM_API_KEY` 为空或未设置
- **THEN** 响应为 200，JSON 包含 `{ configured: false, source: "none" }`

### Requirement: Unified LLM credential resolution

系统 SHALL 在 `lib/llm-config.ts` 中统一解析 LLM 凭据，供 `GET /api/llm-config` 与 `POST /api/chat` 共用。

#### Scenario: Env takes priority

- **WHEN** `LLM_API_KEY` 环境变量非空
- **THEN** 解析结果使用 env 中的 `LLM_API_KEY`
- **AND** 模型使用 `LLM_MODEL` 或默认 `deepseek-chat`
- **AND** base URL 使用 `LLM_BASE_URL` 或默认 `https://api.deepseek.com/v1`
- **AND** 忽略请求体中的 `llmApiKey` 与 `llmModel`

#### Scenario: Request body fallback when env missing

- **WHEN** `LLM_API_KEY` 环境变量为空
- **AND** 请求体包含非空 `llmApiKey` 与非空 `llmModel`
- **THEN** 解析结果使用请求体中的 `llmApiKey` 与 `llmModel`
- **AND** base URL 仍使用 env 或默认 DeepSeek 地址

#### Scenario: No credentials available

- **WHEN** `LLM_API_KEY` 环境变量为空
- **AND** 请求体缺少 `llmApiKey` 或 `llmModel`
- **THEN** 解析失败，调用方 MUST 返回可操作的配置缺失错误

### Requirement: Client-side LLM configuration UI

系统 SHALL 在服务端 env 未配置时，于问答区域提供 `LlmConfigPanel`，允许用户填写 DeepSeek API Key 与模型名称。

#### Scenario: Show config panel when env and localStorage both empty

- **WHEN** `GET /api/llm-config` 返回 `configured: false`
- **AND** 浏览器 `localStorage` 中不存在有效的 `docqa-llm-config`
- **THEN** 问答区展示配置表单（API Key 密码输入框 + 模型名输入框）
- **AND** 模型输入框默认值为 `deepseek-chat`
- **AND** 问答输入区不可用，直至用户保存有效配置

#### Scenario: Save configuration to localStorage

- **WHEN** 用户在配置表单中填写非空 API Key 与模型名并点击保存
- **THEN** 系统将 `{ apiKey, model }` 写入 `localStorage`（key: `docqa-llm-config`）
- **AND** 问答区切换为 `ChatPanel`，允许提问

#### Scenario: Reuse localStorage on page reload

- **WHEN** `GET /api/llm-config` 返回 `configured: false`
- **AND** `localStorage` 中存在有效的 `docqa-llm-config`
- **THEN** 问答区直接展示 `ChatPanel`，不重复展示完整配置表单
- **AND** 用户 MUST 可通过「修改 LLM 配置」入口重新编辑或清除配置

#### Scenario: Hide config UI when env configured

- **WHEN** `GET /api/llm-config` 返回 `configured: true`
- **THEN** 系统 MUST NOT 展示 `LlmConfigPanel`
- **AND** 问答行为与 env 配置策略一致，不要求用户填写密钥

#### Scenario: Validation on empty fields

- **WHEN** 用户提交配置表单但 API Key 或模型名为空
- **THEN** 系统不写入 `localStorage`
- **AND** 展示字段级错误提示

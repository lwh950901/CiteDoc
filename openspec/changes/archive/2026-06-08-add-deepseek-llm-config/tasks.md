## 1. Backend — LLM Config Module

- [x] 1.1 创建 `lib/llm-config.ts`：定义 `ResolvedLlmConfig` 类型，导出 `isServerEnvConfigured()`、`resolveLlmConfig(body?)`、`createLlmClient(config)`
- [x] 1.2 实现 env 优先解析：`LLM_API_KEY` 非空时使用 env；`LLM_MODEL` 缺省默认 `deepseek-chat`；`LLM_BASE_URL` 缺省默认 `https://api.deepseek.com/v1`
- [x] 1.3 实现请求体兜底：env 缺失时读取 `llmApiKey` + `llmModel`；两者缺一返回 null 并供调用方抛错
- [x] 1.4 在 `lib/index.ts` 导出上述公共 API（如项目有统一导出入口）

## 2. Backend — Config Detection API

- [x] 2.1 创建 `app/api/llm-config/route.ts`：`GET` 返回 `{ configured, source, model? }`，永不返回 apiKey
- [x] 2.2 env 已配置时返回 `{ configured: true, source: "env", model: "<resolved>" }`
- [x] 2.3 env 未配置时返回 `{ configured: false, source: "none" }`

## 3. Backend — Chat API Refactor

- [x] 3.1 重构 `app/api/chat/route.ts`：移除 `_llmClient` 单例，改用 `resolveLlmConfig()` + `createLlmClient()` 按请求创建客户端
- [x] 3.2 扩展 POST body 类型，接受可选 `llmApiKey`、`llmModel`；env 已配置时忽略请求体 LLM 字段
- [x] 3.3 凭据缺失时 SSE `error` 事件返回「请先配置 DeepSeek API Key 和模型」
- [x] 3.4 认证失败（401 等）时 SSE `error` 事件返回「DeepSeek API Key 无效，请检查配置」

## 4. Frontend — LLM Config Storage Hook

- [x] 4.1 创建 `lib/useLlmConfig.ts`（或 `hooks/useLlmConfig.ts`）：封装 `localStorage` key `docqa-llm-config` 的读写、清除与类型校验
- [x] 4.2 页面加载时调用 `GET /api/llm-config`，合并服务端状态与 localStorage 得出 `llmReady` 与 `llmCredentials`

## 5. Frontend — LlmConfigPanel Component

- [x] 5.1 创建 `components/LlmConfigPanel.tsx`：API Key（password）+ Model（默认 `deepseek-chat`）+ 保存按钮
- [x] 5.2 空字段校验与错误提示；保存成功后写入 localStorage 并回调父组件
- [x] 5.3 展示 DeepSeek 注册说明/外链（https://platform.deepseek.com）及 `.env.local` 可选配置说明

## 6. Frontend — Page Integration

- [x] 6.1 更新 `app/page.tsx`：根据 `llmReady` 在问答区条件渲染 `LlmConfigPanel` 或 `ChatPanel`
- [x] 6.2 env 已配置（`configured: true`）时不展示配置面板；localStorage 有凭据时直接展示 `ChatPanel`
- [x] 6.3 在 `ChatPanel` 有 localStorage 凭据时提供「修改 LLM 配置」入口（清除/重新编辑）

## 7. Frontend — ChatPanel Request Update

- [x] 7.1 更新 `components/ChatPanel.tsx`：新增可选 prop `llmCredentials?: { apiKey: string; model: string }`
- [x] 7.2 `POST /api/chat` 时在 env 未配置场景附带 `llmApiKey`、`llmModel`
- [x] 7.3 SSE `error` 事件中凭据相关错误展示服务端返回文案

## 8. Documentation

- [x] 8.1 更新 `.env.example`：说明 `LLM_API_KEY` / `LLM_MODEL` env 优先策略及 UI 兜底适用场景
- [x] 8.2 更新 `README.md`：补充「无 env 时可在界面填写 DeepSeek 配置」说明与安全提示（勿在公共机器使用 localStorage 存 key）

## 9. Verification

- [x] 9.1 运行 `npx tsc --noEmit` 确保无类型错误
- [x] 9.2 env 已配置：确认不展示 `LlmConfigPanel`，问答正常；请求体携带的 LLM 字段被忽略
- [x] 9.3 env 未配置 + 无 localStorage：确认展示配置面板，保存后可正常问答
- [x] 9.4 env 未配置 + 有 localStorage：刷新后直接进入问答，body 附带凭据
- [x] 9.5 凭据缺失或无效：确认 SSE error 文案符合 spec（配置缺失 / Key 无效）
- [x] 9.6 `GET /api/llm-config` 响应不含 apiKey 字段

## Why

DocQATracer 的问答功能依赖 `LLM_API_KEY` 和 `LLM_MODEL` 环境变量，但当前仅在 `.env.local` / Vercel 后台手动配置，缺少应用内引导。新用户本地未配置时只能在提问后收到晦涩的 SSE 错误，体验差且不利于 MVP 演示。需要在保留服务端 env 优先策略的前提下，提供 DeepSeek 密钥与模型的可发现、可填写能力。

## What Changes

- 新增 **LLM 配置检测 API**：服务端检查 `LLM_API_KEY` 与 `LLM_MODEL` 是否已在环境变量中配置，向前端返回配置状态（不泄露密钥明文）
- 新增 **DeepSeek 配置 UI**：当 env 未配置时，在问答区域展示配置表单（API Key + 模型名，默认 `deepseek-chat`），引导用户填写后再启用问答
- 当 env 已配置时，**静默使用服务端配置**，不展示配置表单，也不要求用户重复填写
- 更新 **`/api/chat`**：优先使用服务端 env；仅在 env 缺失时接受请求中携带的用户配置（API Key + Model）
- 更新 **`.env.example` / README**：说明 env 优先策略与 UI 填写的适用场景（本地开发无 env 时）

## Capabilities

### New Capabilities

- `llm-config`: 服务端 env 检测、DeepSeek 密钥/模型的前端配置 UI，以及用户配置在问答请求中的传递与校验

### Modified Capabilities

- `qa-api`: LLM 凭据来源扩展为「env 优先，请求级配置兜底」；未配置时返回明确、可操作的错误信息
- `qa-ui`: 问答面板在 LLM 未就绪时展示配置引导态，替代仅显示禁用输入框或事后 SSE 错误

## Impact

- **API**：新增 `GET /api/llm-config`（或等效端点）检测配置状态；`POST /api/chat` 请求体可选携带 `llmApiKey`、`llmModel`
- **前端**：`app/page.tsx`、`components/ChatPanel.tsx` 或新增 `LlmConfigPanel` 组件
- **后端**：`app/api/chat/route.ts` 中 LLM 客户端初始化逻辑；可能抽取 `lib/llm-config.ts` 统一 env/请求配置解析
- **文档**：`.env.example`、`README.md` 补充配置说明
- **依赖**：无新增 npm 包；继续通过 OpenAI 兼容接口调用 DeepSeek

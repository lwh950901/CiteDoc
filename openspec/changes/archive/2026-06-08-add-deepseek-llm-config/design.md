## Context

DocQATracer 问答链路已在 `app/api/chat/route.ts` 中实现：读取 `process.env.LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL` 调用 DeepSeek（OpenAI 兼容接口）。前端 `ChatPanel` 直接 POST 问答，未配置 env 时仅在 SSE `error` 事件中返回「LLM_API_KEY 未配置」。

当前痛点：
- 本地新用户未编辑 `.env.local` 时，无法在不改文件的情况下体验问答
- 错误出现在提问之后，缺乏前置引导
- SiliconFlow 密钥已有类似「检查 env → 提示配置」模式（上传/向量化失败时提示），LLM 侧缺少对称体验

约束：
- 浏览器无法写入 `.env.local`；生产环境（Vercel）应继续以 env 为唯一可信来源
- 项目已有 `localStorage` 先例（`docqa-theme`），可复用相同模式
- 不新增 npm 依赖；继续用 `openai` SDK + Vercel AI SDK 生态下的 OpenAI 兼容调用

## Goals / Non-Goals

**Goals:**
- 服务端 env 已配置 `LLM_API_KEY` + `LLM_MODEL` 时，问答行为与现有一致，UI 不打扰用户
- env 未配置时，问答区展示 DeepSeek 配置表单（API Key + 模型），填写后可正常提问
- 提供 `GET /api/llm-config` 让前端在渲染前获知配置状态（不泄露密钥）
- 统一 `lib/llm-config.ts` 解析 env / 请求级凭据，避免 chat route 内散落逻辑

**Non-Goals:**
- 前端写入或修改 `.env.local` / Vercel 环境变量
- 服务端持久化用户提交的 API Key（数据库、Redis 等）
- 通用的多 LLM 供应商切换 UI（仍固定 DeepSeek base URL，高级用户通过 env 切换 `LLM_BASE_URL`）
- 独立的「测试连接」端点（可在后续迭代；本阶段通过首次问答验证即可）
- 修改 SiliconFlow 嵌入密钥的配置方式

## Decisions

### D1: 凭据优先级 — env 优先，请求体兜底

**选择**: 解析顺序为：
1. 若 `process.env.LLM_API_KEY` 非空 → 使用 env 的 `LLM_API_KEY`、`LLM_MODEL`（缺 model 时默认 `deepseek-chat`）、`LLM_BASE_URL`（缺省时 `https://api.deepseek.com/v1`）
2. 否则若请求体含 `llmApiKey` + `llmModel` → 使用请求级凭据，base URL 仍取 env 或默认值
3. 否则 → 配置缺失，返回可操作错误

**原因**: 满足「本地 env 有就直接用」；生产部署只配 env 即可，用户密钥不会进入请求体。

**备选**: 始终要求 UI 填写 — 与 env 已配置场景冲突，否决。

### D2: 配置检测 API — `GET /api/llm-config`

**选择**: 返回 JSON：
```json
{ "configured": true, "source": "env", "model": "deepseek-chat" }
```
或
```json
{ "configured": false, "source": "none" }
```

- `configured`: 服务端 env 是否已具备完整 LLM 配置
- `source`: `"env"` | `"none"`（本阶段不区分 client 侧缓存，因服务端无法感知 localStorage）
- `model`: 仅当 `source === "env"` 时返回模型名；**永不返回 apiKey 或掩码**

**原因**: 前端据此决定展示配置表单还是直接进入问答；检测逻辑与 chat route 共用 `lib/llm-config.ts`。

**备选**: 在 `GET /api/documents` 中附带 llm 状态 — 职责混杂，否决。

### D3: 前端存储 — `localStorage` 持久化用户填写

**选择**: env 未配置时，用户提交表单后将 `{ apiKey, model }` 存入 `localStorage`（key: `docqa-llm-config`）。每次 `POST /api/chat` 在 body 中附带 `llmApiKey`、`llmModel`。

**原因**: 刷新页面后无需重复填写；实现简单，与主题切换存储模式一致。

**备选**:
- `sessionStorage` — 关闭标签页即丢失，体验较差
- React Context only — 刷新丢失，否决
- Cookie — 不必要地发送到所有请求，且 httpOnly 无法由 JS 写入供 chat body 使用

### D4: UI 结构 — `LlmConfigPanel` + `ChatPanel` 条件渲染

**选择**:
- 页面加载时 `GET /api/llm-config`
- `configured === true` → 直接渲染 `ChatPanel`（与现有一致）
- `configured === false` 且 localStorage 无有效配置 → 在右侧问答区渲染 `LlmConfigPanel`（API Key 密码框 + Model 输入，默认 `deepseek-chat` + 保存按钮）
- `configured === false` 但 localStorage 已有配置 → 渲染 `ChatPanel`，请求时附带凭据；提供「修改 LLM 配置」折叠入口

**原因**: 配置引导占据问答区主位置，符合「先配置再提问」心智；有缓存时不重复阻断。

**备选**: Modal 弹窗 — 对 MVP 过重；内联面板更直观。

### D5: LLM 客户端 — 按请求创建，取消单例缓存

**选择**: 移除 `_llmClient` 模块级单例；`createLlmClient(config: ResolvedLlmConfig)` 每次根据解析结果 `new OpenAI({ apiKey, baseURL })`。

**原因**: 用户请求级 apiKey 与 env apiKey 可能不同；单例会在切换来源时持有错误 key。

**备选**: 单例 + key 变更时重置 — 易漏边界，否决。

### D6: Chat API 请求体扩展

**选择**: `POST /api/chat` body 新增可选字段：
```ts
llmApiKey?: string;
llmModel?: string;
```
仅当服务端 env 未配置时被读取；env 已配置时忽略请求体中的 LLM 字段（防止客户端覆盖生产密钥）。

**原因**: 最小侵入；与现有 `documentId`、`question`、`history` 并存。

### D7: 错误文案统一

**选择**:
- env 与请求均无凭据 → SSE error: `"请先配置 DeepSeek API Key 和模型"`
- 凭据无效（401）→ `"DeepSeek API Key 无效，请检查配置"`
- env 已配置时不暴露「请在 UI 填写」类文案

**原因**: 与 proposal 中 qa-api / qa-ui 改进目标一致。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 用户 API Key 存于 localStorage，XSS 可窃取 | MVP 本地演示可接受；生产依赖 env；文档说明勿在公共机器使用 UI 填 key |
| API Key 经 POST body 传输 | 仅 HTTPS；服务端不 log body；不在 GET 接口回显 |
| env 半配置（仅有 KEY 无 MODEL） | `isServerEnvConfigured()` 要求两者均非空，或 MODEL 缺省时视为已配置并使用默认 model |
| 用户填错 model 名称导致 404 | 错误信息引导检查 model；默认预填 `deepseek-chat` |
| localStorage 与 env 同时存在 | 严格 env 优先，忽略 localStorage，避免混淆 |
| ChatPanel 需感知 llm 凭据 | 通过 props `llmCredentials?: { apiKey, model }` 或自定义 hook `useLlmConfig()` 注入 fetch body |

## Migration Plan

1. 新增 `lib/llm-config.ts` 与 `GET /api/llm-config`
2. 重构 `app/api/chat/route.ts` 使用 `resolveLlmConfig()`
3. 新增 `components/LlmConfigPanel.tsx`；更新 `app/page.tsx` 条件渲染
4. 更新 `ChatPanel` 在 fetch 时附带可选 LLM 字段
5. 更新 `.env.example`、`README.md` 说明 env 优先与 UI 兜底场景
6. **部署**: Vercel 已配 env 的用户无感知；未配 env 的预览部署可依赖 UI 填 key 做演示
7. **回滚**: 移除新 API 与 UI，恢复 chat route 仅读 env（行为与当前 main 一致）

## Open Questions

- 是否在 `LlmConfigPanel` 提供「注册 DeepSeek」外链（https://platform.deepseek.com）— 建议有，降低新用户摩擦
- env 仅配 `LLM_API_KEY` 未配 `LLM_MODEL` 是否算「已配置」— 建议算，model 默认 `deepseek-chat`
- 是否需要在设置区同时展示 SiliconFlow 配置状态 — 本变更范围外，保持仅 LLM

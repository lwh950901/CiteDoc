## Context

Phase 1-4 已完成文档上传→解析→切分→向量化。`chunks` 表中有 13 条带 1024 维 BGE-M3 embedding 的记录，pgvector 余弦相似度查询已验证可用。现在需要在已有基础上实现"用户提问→向量检索→LLM 回答→溯源映射"的完整 RAG 流程。

## Goals / Non-Goals

**Goals:**
- 用户通过 API 向前端对已向量化文档提问，获得带 `[1]` `[2]` 引用标记的答案
- 每个引用可追溯到 chunk 的页码 + 字符偏移区间
- 文档中无相关信息时 LLM 明确告知而非编造

**Non-Goals:**
- 流式回答（SSE）— 留给 Phase 6
- 多轮对话 — 留给 Phase 7
- 混合检索（BM25 + 向量）— MVP 纯向量检索
- 前端双栏高亮跳转 — 留给 Phase 6 UI 专项
- 多文档跨文档检索 — 当前限定单文档

## Decisions

### D1: LLM 选型 — DeepSeek `deepseek-chat`

**选择**: DeepSeek 作为默认 LLM，通过 OpenAI 兼容接口调用（`baseURL: https://api.deepseek.com/v1`）。

**原因**: 项目已在使用 deepseek-v4-flash 做连接测试；价格低廉；中文能力强；OpenAI SDK 直接兼容，无需额外适配。

**备选**: 通过环境变量 `LLM_BASE_URL` / `LLM_MODEL` 可切换为任何 OpenAI 兼容服务（GPT-4o、Qwen 等），零代码改动。

### D2: 检索策略 — 纯向量余弦相似度

**选择**: 问题向量化（BGE-M3）× chunk embedding 的余弦相似度（`1 - (embedding <=> query_vector)`），取 top K=4。

**原因**: 简单、已验证（Phase 4 测试通过）。BGE-M3 对中英文均表现良好。K=4 在上下文窗口和召回覆盖之间取得平衡。

**备选**: 混合检索（BM25 关键词 + 向量语义）精度更高但复杂度大，MVP 不需要。

### D3: 引用标记方案 — `[序号]` 正则解析

**选择**: 
1. Prompt 中将检索到的 chunk 标记为 `[1]` `[2]` ... `[N]`，system prompt 明确要求 LLM 在引用时使用 `[序号]`
2. 后端用 `/(\d+)\]/g` 正则解析答案中的引用编号
3. 去重后映射回对应 chunk 的 page / charStart / charEnd

**原因**: 不依赖 LLM 输出结构化 JSON（不稳定），正则解析简单可靠。`[数字]` 是 LLM 能自然遵循的格式。

**备选**: 要求 LLM 返回 `{ answer, citations: [...] }` JSON — 结构化输出格式更标准但非 streaming 时头部 token 延迟，且小模型（deepseek-chat）容易格式错误。

### D4: 非流式优先

**选择**: MVP 先用 `stream: false`，一次性获取完整回答后解析引用。

**原因**: 流式场景下 `[数字]` 标记可能跨 chunk 分割（如 `[1` 在 chunk A，`2]` 在 chunk B），解析逻辑复杂。非流式规避此问题，Phase 6 专项处理流式。

### D5: Temperature 策略

**选择**: LLM 调用使用 `temperature: 0.3`。

**原因**: 低温度减少 LLM 随机性，提高 `[序号]` 引用标记的一致性和可靠性。用户期望的是基于文档的事实性回答，而非创意性输出。

### D6: 问题向量化客户端 — 复用 SiliconFlow + 延迟初始化

**选择**: `lib/retriever.ts` 中使用与 `lib/embeddings.ts` 相同的延迟初始化模式（`let _client; function getClient()`），复用 SiliconFlow BAAI/bge-m3。

**原因**: 问题和 chunk 必须用同一模型向量化才有意义（语义空间一致性）。延迟初始化避免模块加载时环境变量缺失报错。

### D7: 前端方案 — 最小可用 QAPanel 组件

**选择**: `components/QAPanel.tsx` — 输入框 + 提问按钮 + 答案区（纯文本） + sources 列表（页码 + snippet）。先不实现溯源跳转。

**原因**: Phase 6 会专项优化前端交互（双栏、高亮、跳转），Phase 5 只需确认数据流正确。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| LLM 不遵循 `[序号]` 引用格式，回答中无标记 | system prompt 强调要求；后端 `parseReferences` 空数组时 sources 为空但 answer 仍返回 |
| 检索到的 chunk 不包含答案信息 | Prompt 中已有"根据现有资料无法回答"约束；额外：cosine similarity < 0.3 的 chunk 可考虑过滤（Phase 5 暂不强制） |
| DeepSeek API 额度不足或不可用 | 通过环境变量可切换到其他 LLM；chat API catch 块捕获 auth 错误返回明确提示 |
| BAAI/bge-m3 对问题 vs 文档的语义对齐不佳 | BGE-M3 支持多语言 + 长文本，已验证 chunk 向量间相似度合理（distance 0.33-0.42） |
| 前端未做文档选择，依赖写死的 documentId | QAPanel 接受 `documentId` prop；Phase 6 添加文档选择器 |

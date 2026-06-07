## Why

前四阶段已完成文档上传、解析、切分、向量化全流程，数据库中有带 embedding 的 chunk 记录。现在实现项目的核心价值——用户对已向量化文档提问，AI 在回答中用 `[1]` `[2]` 标记引用来源，每条引用可追溯到原文的页码和字符偏移区间。这是 DocQATracer 区别于普通文档问答工具的关键差异点。

## What Changes

- **新增向量检索模块** `lib/retriever.ts`：将用户问题向量化，在 chunks 表中执行 pgvector 余弦相似度查询，返回 top K 最相关 chunk 及其元数据
- **新增 QA Prompt 构建模块** `lib/prompt.ts`：将检索到的 chunk 拼接为带 `[序号]` 标记的上下文，生成 system prompt 要求 LLM 基于资料回答并标注引用
- **新增 QA API 端点** `app/api/chat/route.ts`（覆盖旧的测试端点）：POST `{ documentId, question }` → 检索 → 构建 Prompt → 调用 LLM → 解析引用标记 → 返回 `{ answer, sources }`
- **新增前端问答面板** `components/QAPanel.tsx`：问题输入框 + 答案展示 + sources 溯源列表
- **环境变量更新** `.env.local`：添加 `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`

## Capabilities

### New Capabilities

- `vector-retrieval`: 问题向量化 + pgvector 余弦相似度检索 top K chunk，返回内容 + 页码 + 字符偏移
- `qa-prompt`: 将 chunk 组装为带序号标记的 Prompt 上下文，包含 system prompt 约束 LLM 行为
- `qa-api`: POST /api/chat 端点，串联检索→Prompt→LLM→引用解析全流程，返回 answer + sources
- `qa-ui`: 前端问答面板，问题输入、答案展示、sources 溯源列表

### Modified Capabilities

<!-- 无已有 spec 被修改 — 所有均为新增能力 -->

## Impact

- **新增文件**: `lib/retriever.ts`, `lib/prompt.ts`, `components/QAPanel.tsx`
- **覆盖文件**: `app/api/chat/route.ts`（旧测试端点 → 完整 QA 端点）
- **修改文件**: `app/page.tsx`（集成 QAPanel 组件）, `.env.local`（新增 LLM 环境变量）
- **依赖**: SiliconFlow API（问题向量化）、DeepSeek API（LLM 回答）、pgvector（相似度搜索）
- **类型导出**: `lib/index.ts` 需新增 `RetrievedChunk` 类型导出

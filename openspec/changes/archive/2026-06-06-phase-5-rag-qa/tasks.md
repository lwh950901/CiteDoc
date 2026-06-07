## 1. Environment Setup

- [x] 1.1 在 `.env.local` 中添加 `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`（默认 DeepSeek）
- [x] 1.2 在 `.env.example` 中添加对应的占位说明

## 2. Vector Retrieval Module

- [x] 2.1 创建 `lib/retriever.ts`：延迟初始化 SiliconFlow 客户端，`retrieveChunks(question, documentId, topK=4)` 生成问题向量，执行 pgvector `<=>` 余弦相似度查询
- [x] 2.2 查询结果包含 `id, content, metadata (page/charStart/charEnd), similarity`，`similarity = 1 - cosine_distance`
- [x] 2.3 在 `lib/index.ts` 中导出 `RetrievedChunk` 类型和 `retrieveChunks` 函数

## 3. QA Prompt Module

- [x] 3.1 创建 `lib/prompt.ts`：`buildQAPrompt(question, chunks)` 将 chunk 组装为 `[1] chunk内容\n\n[2] chunk内容...` 的上下文字符串
- [x] 3.2 systemPrompt 要求 LLM 基于资料回答、用 `[序号]` 标记引用、资料不足时说"根据现有资料无法回答"

## 4. QA API Endpoint

- [x] 4.1 覆盖 `app/api/chat/route.ts`：实现 `POST { documentId, question }` 串联检索 → Prompt → LLM → 引用解析全流程
- [x] 4.2 实现 `parseReferences` 辅助函数：正则 `\[(\d+)\]/g` 提取引用 → 去重 → 过滤越界编号 → 映射到 chunk 元数据
- [x] 4.3 参数缺失时返回 400；LLM 调用失败时返回 500 并包含明确错误信息

## 5. Frontend QAPanel

- [x] 5.1 创建 `components/QAPanel.tsx`：输入框 + "提问"按钮 + 答案展示区 + sources 列表
- [x] 5.2 处理三种状态：loading（按钮 disabled + 加载文本）、empty（初始状态）、error（错误提示）
- [x] 5.3 在 `app/page.tsx` 中集成 QAPanel 组件（先写死测试文档 ID）

## 6. Verification

- [x] 6.1 运行 `npx tsc --noEmit` 确保无类型错误
- [x] 6.2 curl 测试完整问答流程：POST /api/chat `{ documentId, question }` → 验证 answer 含 `[1]` 标记、sources 非空、id/page/charStart/charEnd 正确
- [x] 6.3 curl 测试缺少参数返回 400
- [x] 6.4 手动验证 source 的 charStart/charEnd 在原文中定位到正确的文本片段（substring 验证）

# 第五阶段任务：问答检索与溯源映射（RAG 核心）

## 任务目标
实现完整的“文档问答”后端逻辑：用户提问 → 向量检索相关 chunk → 构建 Prompt → 调用 LLM 生成带引用的答案 → 解析引用标记 → 返回答案与溯源元数据（页码、字符偏移等）。这是整个项目的核心功能，直接体现“可溯源文档问答”的价值。

完成后，你可以通过 API 向已向量化的文档提问，获得带 `[1]` `[2]` 角标的答案，并得到每个角标对应的原文位置信息。

---

## 前置条件
- 第四阶段完成，`chunks` 表中已有带 embedding 的记录
- pgvector 可用，余弦相似度查询正常
- LLM 服务可用（推荐使用 DeepSeek，也可配置其他兼容 OpenAI 接口的服务）
- 环境变量中已配置 LLM 的 `API_KEY` 和 `BASE_URL`

---

## 核心设计决策
1. **LLM 选择**：默认使用 **DeepSeek**（`deepseek-chat`），兼容 OpenAI 接口格式。如果你想用其他模型（如 GPT-4o、Qwen 等），只需修改环境变量。
2. **检索策略**：纯向量相似度检索（余弦距离），取 top K（默认 4），简单高效。后续可扩展混合检索。
3. **溯源标记方案**：在 Prompt 中要求 LLM 回答时用 `[序号]` 引用给定的文档片段，序号对应检索到的 chunk 编号。后端解析答案中的 `[数字]`，映射回 chunk 的元数据（页码、字符偏移区间）。
4. **非流式优先**：MVP 阶段先用非流式实现，确保溯源解析正确。流式交互将在第六阶段专项优化。
5. **上下文管理**：支持多轮对话（将历史消息附在 Prompt 中），但本次 MVP 先实现单轮问答；多轮对话可后续在第七阶段增强。

---

## 任务拆解

### 1. 更新环境变量
在 `.env.local` 中添加 LLM 相关配置：
```env
# 使用 DeepSeek（推荐）
LLM_API_KEY="sk-your-deepseek-key"
LLM_BASE_URL="https://api.deepseek.com/v1"
LLM_MODEL="deepseek-chat"

# 若使用其他兼容 OpenAI 接口的服务，修改以上三行即可
```
请确保 `.env.local` 已配置，并且 API Key 有效。

### 2. 创建向量检索模块
**文件路径**: `lib/retriever.ts`

实现函数 `retrieveChunks`：接收问题文本，调用嵌入模型将其向量化，然后在 `chunks` 表中执行余弦相似度查询，返回最相关的 K 个 chunk（带元数据）。

```ts
import OpenAI from 'openai';
import { db } from './db';
import { chunks } from '@/db/schema';
import { sql } from 'drizzle-orm';

// 嵌入客户端（复用 SiliconFlow 免费模型）
const embedClient = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: 'https://api.siliconflow.cn/v1',
});

export interface RetrievedChunk {
  id: string;
  content: string;
  metadata: {
    page: number;
    charStart: number;
    charEnd: number;
  };
  similarity: number;
}

export async function retrieveChunks(
  question: string,
  documentId: string,
  topK: number = 4
): Promise<RetrievedChunk[]> {
  // 1. 生成问题的向量
  const embRes = await embedClient.embeddings.create({
    model: 'BAAI/bge-m3',
    input: question,
  });
  const queryEmbedding = embRes.data[0].embedding;

  // 2. 用余弦相似度检索（pgvector 的 <=> 操作符表示余弦距离）
  const vectorStr = `[${queryEmbedding.join(',')}]`;
  const rows = await db.execute(sql`
    SELECT
      id,
      content,
      metadata,
      1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM chunks
    WHERE document_id = ${documentId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${topK}
  `);

  // 3. 格式化返回
  return rows.rows.map((row: any) => ({
    id: row.id,
    content: row.content,
    metadata: JSON.parse(row.metadata), // { page, charStart, charEnd }
    similarity: Number(row.similarity),
  }));
}
```

> 说明：如果 `db.execute` 无法直接使用，请改用 Drizzle 的 `db.select().from(chunks)...` 配合 `sql` 模板。确保类型安全。

### 3. 构造溯源 Prompt
**文件路径**: `lib/prompt.ts`

导出一个函数 `buildQAContext`，将检索到的 chunk 拼接为 Prompt 的上下文部分，要求 LLM 严格基于资料回答并标注引用。

```ts
import { RetrievedChunk } from './retriever';

export function buildQAPrompt(question: string, chunks: RetrievedChunk[]) {
  // 将 chunk 编为 [1] [2] 等
  const contexts = chunks
    .map((c, i) => `[${i + 1}] ${c.content}`)
    .join('\n\n');

  const systemPrompt = `你是一个严谨的文档助手，只能基于下面提供的文档片段回答问题。
如果文档片段不足以回答问题，请明确说“根据现有资料无法回答”，不要编造信息。
回答时，如果引用某个片段，请使用 [序号] 标记，例如 “根据文档，2025年销售额增长了12%[1]”。`;

  const userMessage = `文档片段：
${contexts}

问题：${question}`;

  return { systemPrompt, userMessage };
}
```

### 4. 创建问答 API 路由（核心）
**文件路径**: `app/api/chat/route.ts`

POST 接收 `{ documentId, question }`，流程：
1. 参数校验
2. 检索相关 chunk（`retrieveChunks`）
3. 构建 Prompt
4. 调用 LLM（DeepSeek 或其他）
5. 解析答案中的 `[数字]` 标记，生成 sources 数组
6. 返回 `{ answer, sources }`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { retrieveChunks } from '@/lib/retriever';
import { buildQAPrompt } from '@/lib/prompt';
import OpenAI from 'openai';

const llmClient = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_BASE_URL,
});

export async function POST(req: NextRequest) {
  try {
    const { documentId, question } = await req.json();
    if (!documentId || !question) {
      return NextResponse.json({ error: '缺少 documentId 或 question' }, { status: 400 });
    }

    // 1. 检索
    const retrieved = await retrieveChunks(question, documentId, 4);
    if (retrieved.length === 0) {
      return NextResponse.json({
        answer: '文档中未找到相关信息。',
        sources: [],
      });
    }

    // 2. 构建 Prompt
    const { systemPrompt, userMessage } = buildQAPrompt(question, retrieved);

    // 3. 调用 LLM（非流式）
    const completion = await llmClient.chat.completions.create({
      model: process.env.LLM_MODEL || 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3, // 降低随机性，提高引用稳定性
    });

    const rawAnswer = completion.choices[0]?.message?.content || '无法获取回答。';

    // 4. 解析引用标记 [1] [2] ...
    const sources = parseReferences(rawAnswer, retrieved);

    return NextResponse.json({
      answer: rawAnswer,
      sources,
    });
  } catch (err: any) {
    console.error('问答出错:', err);
    return NextResponse.json({ error: err.message || '服务器内部错误' }, { status: 500 });
  }
}

// 解析辅助函数
function parseReferences(answer: string, retrieved: any[]) {
  const refRegex = /\[(\d+)\]/g;
  const matches = [...answer.matchAll(refRegex)];
  const uniqueRefs = [...new Set(matches.map(m => parseInt(m[1])))];

  return uniqueRefs
    .filter(ref => ref > 0 && ref <= retrieved.length)
    .map(ref => {
      const chunk = retrieved[ref - 1];
      return {
        id: ref,
        page: chunk.metadata.page,
        charStart: chunk.metadata.charStart,
        charEnd: chunk.metadata.charEnd,
        snippet: chunk.content.slice(0, 100), // 前100字符作为摘要
      };
    });
}
```

### 5. 前端测试界面（最小可用）
**文件**: `app/page.tsx` 或新建 `components/QAPanel.tsx`

提供一个文本输入框（输入问题），一个展示答案的区域，以及显示 sources 列表的调试面板。先不实现双栏跳转（留给第六阶段），但需要确认 answers 和 sources 数据正确。

示例逻辑：
- 输入框 + “提问”按钮
- 状态管理：`question`, `answer`, `sources`, `loading`
- 调用 POST `/api/chat`，传入当前文档 ID（可先写死测试文档 ID）
- 展示带 `[1]` 的答案（先纯文本显示）
- 在下方列出 sources 的页码和 snippet 预览

### 6. 测试与验证
1. 选择一个已向量化的文档 ID，通过 curl 或界面提问：“根据文档，XX 是什么？”
2. 检查响应中的 `answer` 包含 `[1]` `[2]` 标记。
3. 确认 `sources` 数组长度 > 0，每个 source 包含正确的 `page`, `charStart`, `charEnd`。
4. 手动验证 `charStart` 到 `charEnd` 在原文中确实对应相关段落（可在数据库查 `documents.content` 用 substring 验证）。
5. 提问一个文档中不存在的话题，应返回“根据现有资料无法回答”，且 sources 为空或无需标记。

---

## 验收检查清单
- [ ] 环境变量 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL` 已正确配置（DeepSeek 可用）
- [ ] 检索模块能根据问题返回语义相关的 chunk，相似度降序排列
- [ ] 问答 API 正常工作，返回 `answer` 和 `sources`
- [ ] 答案中的 `[数字]` 标记数量与 sources 数组长度一致，且编号正确
- [ ] 每个 source 的 `charStart/charEnd` 区间能在原文中定位到对应文本
- [ ] 无相关答案时 LLM 不会编造，返回明确提示
- [ ] 参数缺失时返回 400 错误

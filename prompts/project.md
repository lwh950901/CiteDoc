# 项目：带来源溯源的智能文档问答（DocQATracer）

## 一、项目目标
构建一个 RAG（检索增强生成）Web 应用，用户可以上传 PDF/Word 文档，并针对文档内容进行提问。核心差异点是：**每个回答中的关键事实都会附带可点击的角标，点击后能直接跳转到原文对应位置并高亮显示**，实现答案可溯源。

## 二、技术栈（全部使用 TypeScript，无需 Python）
- **框架**: Next.js 14+ (App Router)
- **AI 调用与流式响应**: Vercel AI SDK (`ai` 包)
- **文档解析**: `pdf-parse`（PDF）、`mammoth`（Word）
- **向量数据库**: PostgreSQL + pgvector（本地用 Docker，后续可迁移到 Vercel Postgres 或 Supabase）
- **ORM**: Drizzle ORM
- **向量化模型**: OpenAI text-embedding-ada-002（1536维）
- **LLM 问答**: OpenAI GPT-4o 或 GPT-3.5-turbo（通过 Vercel AI SDK 调用）
- **前端样式**: Tailwind CSS
- **部署**: Vercel

## 三、核心功能需求

### 1. 文档上传与解析
- 用户通过 `<input type="file">` 上传 PDF 或 Word 文件
- 后端提取文本时，**必须保留位置元数据**：
  - 对于 PDF：记录每个文本段落的页码、在全文中的字符起始/结束偏移量
  - 对于 Word：类似处理，分段落记录
- 解析结果存储：
  - 原始全文存入 `documents` 表
  - 经过切分后的文档块存入 `chunks` 表，每个 chunk 携带 `metadata`（JSON 格式，含页码、字符偏移范围）

### 2. 文档切分（自定义 Splitter）
- 不能直接使用现成 RecursiveCharacterTextSplitter，因为要保留溯源信息
- 实现一个函数 `splitTextWithMeta`：
  - 输入：解析得到的带段落元数据的数组
  - 参数：chunkSize（默认500字符）, overlap（默认50字符）
  - 输出：一个数组，每个元素包含 `content`（文本）、`metadata`（页码、charStart、charEnd、文档ID）
- 切分逻辑：滑动窗口，当窗口内容长度达到 chunkSize 时保存一个 chunk，并移动 overlap 距离

### 3. 向量化与存储
- 对每个 chunk 调用 OpenAI Embedding API 生成 1536 维向量
- 批量处理（每批最多20条），避免限流
- 使用 Drizzle 将 embedding 和元数据一起插入 `chunks` 表
- 在 `embedding` 列上建立 HNSW 索引（pgvector 支持）以加速检索

### 4. 问答检索（RAG 核心）
- 用户提问时：
  1. 将问题向量化
  2. 在 `chunks` 表中用余弦相似度检索 top K（例如 K=4）最相关 chunk
  3. 将检索到的 chunk 内容拼接成上下文 Prompt，**要求 LLM 在回答中引用出处**，格式为 `[1]`、`[2]` 等，分别对应提供的上下文 chunk 的索引
- 检索可以预留混合检索接口（向量相似度 + BM25 关键词），但 MVP 阶段可用纯向量检索

### 5. 答案溯源映射与返回
- 后端接收到 LLM 的回答后，解析出其中的引用标记（正则匹配 `\[(\d+)\]`）
- 每个标记映射回对应的 chunk 元数据（页码、字符偏移）
- 构造返回的溯源数组（`sources`），每个元素包含：引用编号、页码、在全文中的 charStart/charEnd、以及该 chunk 的摘要片段
- 最终 API 返回格式：
  ```ts
  {
    answer: string,           // 原始答案文本（含[1][2]标记）
    sources: Array<{
      id: number,
      page: number,
      charStart: number,
      charEnd: number,
      snippet: string
    }>,
    documentFullText: string   // 整个文档的纯文本，供前端高亮定位用
  }
  ```

### 6. 流式输出与溯源联动（关键交互）
- 采用 Vercel AI SDK 的流式响应
- **策略**：先非流式调用 LLM 获取完整答案（确保溯源标记完整），解析出 sources 元数据后，再将答案文本以流式方式推送到前端，同时通过 Server-Sent Events 的自定义事件先发送 sources 数据。
- 前端使用 `useChat` 或自定义 `EventSource` 处理：
  - 先接收 `sources` 事件，存储溯源映射表
  - 再接收文本 token 流，实时拼接渲染
  - 当检测到 `[1]` 等标记时，动态替换为可点击的 `<sup>` 角标

### 7. 前端双栏布局与高亮跳转
- **左栏**：文档原文展示区（可滚动）
  - 原文需要按照 chunk 的 charStart/charEnd 切割成多个 `<span>`，并赋予 `id="chunk-{id}"`
  - 默认样式正常，当某个 chunk 被激活时添加高亮背景色（如 `bg-yellow-200`）
- **右栏**：对话流（类似聊天界面）
  - 显示用户问题、AI 回答气泡
  - 回答中的角标按钮点击事件：获取对应 sources 中的 charStart/charEnd，在左栏调用 `scrollIntoView` 并高亮对应区间
- 支持多轮对话（保留对话历史上下文）

### 8. 错误处理与状态管理
- 上传失败：文件格式错误、大小超限 → 友好提示
- 解析失败：PDF 损坏等 → 提示用户并允许重试
- AI 调用超时：设置超时时间，前端显示重试按钮
- 检索无结果：显示“文档中未找到相关信息”
- 加载态：骨架屏、流式打字时的光标效果、提交按钮 disabled 状态

## 四、数据库 Schema 设计（Drizzle ORM）
```ts
// db/schema.ts
import { pgTable, text, uuid, vector, index } from 'drizzle-orm/pg-core';

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  content: text('content').notNull(), // 全文
  createdAt: timestamp('created_at').defaultNow(),
});

export const chunks = pgTable('chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  metadata: text('metadata'), // JSON: { page, charStart, charEnd }
}, (table) => ({
  embeddingIndex: index('embedding_index').using('hnsw', table.embedding.op('vector_cosine_ops')),
}));
```

## 五、项目结构建议
```
doc-qa-tracer/
├── app/
│   ├── api/
│   │   ├── upload/route.ts      # 文件上传处理
│   │   ├── chat/route.ts        # 问答流式接口
│   │   └── documents/route.ts   # 文档列表/删除
│   ├── layout.tsx
│   ├── page.tsx                 # 主界面
│   └── [docId]/
│       └── page.tsx             # 指定文档的问答页
├── components/
│   ├── FileUpload.tsx
│   ├── DocumentViewer.tsx       # 左栏原文，带分段标注
│   ├── ChatPanel.tsx            # 右栏对话
│   └── AnswerBubble.tsx         # AI 回答气泡，处理角标
├── lib/
│   ├── db.ts                    # Drizzle 连接
│   ├── parser.ts                # 文档解析 + 分割
│   ├── embeddings.ts            # 向量化
│   ├── retriever.ts             # 检索逻辑
│   └── prompt.ts                # Prompt 模板
├── db/
│   ├── schema.ts
│   └── migrate.ts
├── .env.local
├── docker-compose.yml           # 仅本地 pgvector
├── tailwind.config.ts
└── package.json
```

## 六、开发步骤指导（按优先级）
1. **环境搭建**：项目初始化、Docker 启动 pgvector、Drizzle 配置及迁移
2. **文件上传与解析**：实现 parser.ts，能正确提取文本和位置元数据
3. **文本分割**：实现自定义 splitter，保证元数据不丢失
4. **向量化与存储**：调用 Embedding API，批量写入数据库
5. **基础问答接口**：先实现非流式 RAG，返回带标记的答案和 sources，验证溯源映射正确
6. **流式改造**：用 AI SDK 将答案转为 SSE，前端接流
7. **前端溯源交互**：双栏布局、角标点击跳转、高亮实现
8. **错误处理与美化**：各状态覆盖、Tailwind 样式打磨
9. **多轮对话**：在 Chat 接口中加入对话历史（最近 N 轮），保持上下文
10. **部署**：迁移到 Vercel Postgres 或 Supabase，环境变量设置，一键部署

## 七、关键设计决策说明
- **为什么先完整生成再流式**：溯源标记可能分散在答案各处，流式状态下难以实时解析未完成的引用标记，先获取完整答案再流式展示可避免解析错误，并提前发送溯源元数据
- **为什么用自定义分块而非 LangChain 默认**：商业分块器不保留字符偏移，会导致无法精准定位到原文段落
- **为什么全文传给前端**：为了方便前端实现滚动高亮，原文数据量可控（一般文档几十到几百KB）
- **向量检索距离**：使用余弦相似度（`vector_cosine_ops`），适合文本语义匹配

## 八、验收标准
- 上传一份 10 页左右的 PDF 产品说明书，问“XX 产品的保修期限是多少？”，答案中包含 `[1]` 角标
- 点击角标，左栏原文自动滚动到对应段落并高亮，段落内容与答案相关
- 支持追问，历史记录保留，每次答案中的溯源标记依然可正确跳转
- 界面响应式，移动端也能使用

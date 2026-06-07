# DocQATracer - 文档问答溯源工具

带来源溯源的智能文档问答（RAG）Web 应用。上传 PDF/Word 文档后提问，AI 答案中的每条引用都可以点击跳转到原文对应位置并高亮显示。

![DocQATracer](https://img.shields.io/badge/Next.js-15+-black?logo=next.js) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?logo=postgresql)

## 功能特性

- **📄 文档上传**: 支持 PDF / DOCX，自动解析、分段、向量化
- **🔍 向量检索**: BAAI/bge-m3 1024 维嵌入 + pgvector 余弦相似度检索
- **💬 流式问答**: SSE 逐字打字机效果，引用角标点击溯源
- **🎯 溯源高亮**: 点击答案中的 [1] [2] 引用角标，左侧文档原文自动滚动到对应段落并高亮
- **📖 双栏布局**: 左侧文档原文 + 右侧问答面板，响应式设计

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 15+ (App Router) |
| 语言 | TypeScript (strict mode) |
| LLM | DeepSeek deepseek-chat (OpenAI 兼容 API) |
| 嵌入模型 | BAAI/bge-m3 via SiliconFlow API (1024 维) |
| 向量数据库 | PostgreSQL + pgvector (HNSW 索引) |
| ORM | Drizzle ORM |
| 样式 | Tailwind CSS |
| 文档解析 | pdf-parse + mammoth |
| 流式通信 | Server-Sent Events (SSE) |

## 快速开始

### 前置要求

- Node.js 18+
- Docker Desktop
- DeepSeek API Key ([注册](https://platform.deepseek.com))
- SiliconFlow API Key ([注册](https://siliconflow.cn)) — BAAI/bge-m3 免费使用

### 1. 启动数据库

```bash
docker-compose up -d
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`，填入 API Key：

```env
DATABASE_URL="postgres://postgres:postgres@localhost:5432/docqa"
LLM_API_KEY="sk-..."              # DeepSeek API Key
LLM_BASE_URL="https://api.deepseek.com/v1"
LLM_MODEL="deepseek-chat"
SILICONFLOW_API_KEY="sk-..."      # SiliconFlow API Key (向量嵌入)
```

### 3. 安装 & 迁移

```bash
npm install --legacy-peer-deps
npx drizzle-kit push
```

### 4. 启动

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)，上传文档即可开始问答。

## 项目结构

```
├── app/
│   ├── api/
│   │   ├── upload/route.ts              # 文件上传 + 自动向量化
│   │   ├── chat/route.ts                # SSE 流式问答
│   │   └── documents/
│   │       ├── route.ts                 # 文档列表 / 补生成嵌入
│   │       └── [id]/
│   │           ├── route.ts             # 文档详情
│   │           ├── chunks/route.ts      # 文档分段
│   │           └── embed/route.ts       # 向量嵌入
│   ├── layout.tsx
│   ├── page.tsx                         # 主界面（双栏布局）
│   └── globals.css                      # highlight-pulse 动画
├── components/
│   ├── FileUpload.tsx                   # 文件上传（紧凑模式）
│   ├── DocumentViewer.tsx               # 文档原文 + chunk 高亮
│   └── ChatPanel.tsx                    # 流式问答 + 打字机 + 引用
├── lib/
│   ├── db.ts                            # Drizzle 数据库连接
│   ├── types.ts                         # 共享类型（Source）
│   ├── parser.ts                        # PDF/DOCX 解析
│   ├── splitter.ts                      # 滑动窗口文本切分
│   ├── embeddings.ts                    # BGE-M3 批量向量化
│   ├── retriever.ts                     # pgvector 余弦相似度检索
│   ├── prompt.ts                        # RAG Prompt 模板
│   └── index.ts                         # 统一导出
├── db/
│   ├── schema.ts                        # documents / chunks 表
│   └── migrations/
├── openspec/
│   ├── specs/                           # 主能力规格
│   └── changes/archive/                 # 已归档 change
├── reviews/                             # Code Review 报告
├── docker-compose.yml
├── .env.example
└── .env.local
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/upload` | 上传 PDF/DOCX，自动解析 + 分段 + 向量化 |
| `POST` | `/api/chat` | SSE 流式问答（event: sources/text/done/error） |
| `GET` | `/api/documents` | 获取最近上传的文档（首页自动加载） |
| `POST` | `/api/documents` | 为文档补生成向量嵌入 |
| `GET` | `/api/documents/:id` | 文档详情（全文） |
| `GET` | `/api/documents/:id/chunks` | 文档分段列表 |
| `POST` | `/api/documents/:id/embed` | 触发向量嵌入 |
| `GET` | `/api/documents/:id/embed` | 查询向量化进度 |

## SSE 事件格式

```
event: sources
data: [{"id":1,"page":3,"chunkId":"...","charStart":2601,...}]

event: text
data: "根"

event: text
data: "据"

event: done
data: "[DONE]"

event: error
data: "错误信息"
```

## 开发路线

- [x] Phase 1: 环境搭建
- [x] Phase 2: 文档上传与解析
- [x] Phase 3: 文本智能切分
- [x] Phase 4: 向量化存储
- [x] Phase 5: RAG 问答系统
- [x] Phase 6: 流式问答 + 溯源交互 + P0 优化
- [ ] Phase 7: 多轮对话
- [ ] Phase 8: 部署

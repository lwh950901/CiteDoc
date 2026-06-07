# CiteDoc — 问文档，答有据

CiteDoc 是一个基于 RAG（检索增强生成）的文档问答应用。核心特色是**答案溯源**：所有 AI 生成的关键事实都会标记引用来源，用户可一键跳转到文档原文的对应段落。它不只是"回答问题"，更是"回答问题并告诉你答案在哪"。

![CiteDoc](https://img.shields.io/badge/Next.js-15+-black?logo=next.js) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?logo=postgresql)

## 功能特性

- 📄 支持 PDF 和 DOCX 文档上传与文本提取
- 🔍 语义向量检索（BAAI/bge-m3，1024 维，HNSW 索引）
- 💬 流式 AI 问答，SSE 逐字打字机效果
- 📌 答案溯源角标，点击定位原文并精准高亮
- 💬 多轮对话，保持上下文连贯
- 🌓 亮色 / 暗色双主题，跟随系统或手动切换
- 📱 响应式布局，移动端 Tab 切换可用

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 15+ (App Router) + TypeScript |
| 样式 | Tailwind CSS + CSS 自定义属性（双主题） |
| LLM | DeepSeek（deepseek-chat，兼容 OpenAI API） |
| Embedding | BAAI/bge-m3（通过 SiliconFlow API，1024 维） |
| 向量数据库 | PostgreSQL + pgvector（HNSW 索引） |
| ORM | Drizzle ORM |
| 文档解析 | pdf-parse + mammoth |
| 流式通信 | Server-Sent Events (SSE) |
| 部署 | Vercel + Supabase |

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
LLM_API_KEY="sk-..."              # DeepSeek API Key（推荐在 env 中配置）
LLM_BASE_URL="https://api.deepseek.com/v1"
LLM_MODEL="deepseek-chat"
SILICONFLOW_API_KEY="sk-..."      # SiliconFlow API Key (向量嵌入)
```

**LLM 配置说明：**

- **env 优先**：若 `.env.local` 已设置 `LLM_API_KEY`，应用会直接使用，问答区不展示配置表单。
- **界面兜底**：若未配置 env，可在问答区填写 DeepSeek API Key 与模型（默认 `deepseek-chat`），配置保存在浏览器 `localStorage`。
- **安全提示**：界面填写的 Key 仅适合本地演示；请勿在公共电脑上使用，生产部署请在 Vercel 环境变量中配置 `LLM_API_KEY`。

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
│   │   ├── llm-config/route.ts          # LLM env 配置检测
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
│   ├── DocumentViewer.tsx               # 文档原文 + chunk 高亮
│   ├── ChatPanel.tsx                    # 流式问答 + 打字机 + 引用
│   ├── LlmConfigPanel.tsx               # DeepSeek Key/模型配置（env 未配时）
│   └── ThemeToggle.tsx                  # 亮色/暗色双主题切换
├── hooks/
│   └── useLlmConfig.ts                  # LLM env 检测 + localStorage 凭据
├── lib/
│   ├── llm-config.ts                    # LLM 凭据解析（env 优先）
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

## 项目架构

```
上传文档 → 解析文本（保留字符偏移+页码） → 滑动窗口切分 → BGE-M3 向量化 → 存入 pgvector
                                                                              ↓
提问 → 问题向量化 → 余弦相似度检索 top K → 构建 Prompt → DeepSeek 生成带引用答案
                                                                              ↓
                                                    解析引用 → SSE 流式推送 → 前端逐字展示 + 角标可点击
                                                                              ↓
                                                            点击角标 → 原文滚动高亮
```

## 关键设计

- **自定义文本分割器**：保留每个 chunk 的字符偏移和页码，实现精准溯源
- **先完整生成后流式推送**：确保引用标记解析正确，避免流式状态下解析错误
- **pgvector 替代独立向量库**：减少依赖，数据集中管理，便于混合检索扩展
- **国内模型服务**：SiliconFlow + DeepSeek，有免费额度，API 兼容 OpenAI 格式

## 部署

项目可一键部署到 Vercel（数据库使用 Supabase）：

### 1. Supabase 数据库

1. 注册 [Supabase](https://supabase.com)，创建项目
2. 在 SQL Editor 中启用 pgvector：
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. 获取 **Connection Pooler** 连接字符串（Supabase Dashboard → **Connect** → **Connection pooling** → **Transaction** 模式）

   > **重要**：Vercel 不支持 IPv6，不能使用 Direct Connection（`db.xxx.supabase.co`）。必须使用 Pooler 地址（`xxx.pooler.supabase.com`）。

   正确格式示例：
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```

   常见错误：
   - 使用 `db.xxx.supabase.co`（Direct，Vercel 会 ENOTFOUND）
   - 域名写成 `.supabase.co` 而非 `.pooler.supabase.com`
   - 端口用 5432 的 Direct 连接而非 Pooler 的 6543（Transaction 模式）

### 2. 执行数据库迁移

将本地 `.env.local` 的 `DATABASE_URL` 临时指向 Supabase 连接字符串：

```bash
npx drizzle-kit push
```

执行后恢复本地连接字符串。

### 3. Vercel 部署

1. 在 [Vercel](https://vercel.com) 中导入 GitHub 仓库
2. 在项目 Settings → Environment Variables 中添加：

| 变量 | 值 |
|------|-----|
| `DATABASE_URL` | Supabase 连接字符串 |
| `SILICONFLOW_API_KEY` | SiliconFlow API Key |
| `LLM_API_KEY` | DeepSeek API Key |
| `LLM_BASE_URL` | `https://api.deepseek.com/v1` |
| `LLM_MODEL` | `deepseek-chat` |

3. 点击 Deploy

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/upload` | 上传 PDF/DOCX，自动解析 + 分段 + 向量化 |
| `POST` | `/api/chat` | SSE 流式问答（event: sources/text/done/error）；env 未配时可传 `llmApiKey`/`llmModel` |
| `GET` | `/api/llm-config` | 检测服务端 LLM env 是否已配置（不返回密钥） |
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
- [x] Phase 7: 多轮对话 + 双主题 + 布局重构
- [x] Phase 8: 部署 + README 文档

# DocQATracer - 文档问答溯源工具

带来源溯源的智能文档问答（RAG）Web 应用。上传 PDF/Word 文档后提问，AI 答案中的每条事实都可以点击跳转到原文对应位置并高亮显示。

## 技术栈

- **框架**: Next.js 15+ (App Router)
- **AI**: Vercel AI SDK + DeepSeek (deepseek-chat)
- **嵌入模型**: OpenAI text-embedding-ada-002（向量化）
- **数据库**: PostgreSQL + pgvector (向量检索)
- **ORM**: Drizzle ORM
- **样式**: Tailwind CSS
- **文档解析**: pdf-parse, mammoth

## 快速开始

### 前置要求

- Node.js 18+
- Docker Desktop
- DeepSeek API Key（注册地址：https://platform.deepseek.com）

### 1. 启动数据库

```bash
docker-compose up -d
```

验证数据库连接：

```bash
docker exec -it docqa-pgvector psql -U postgres -d docqa -c "SELECT 1;"
```

### 2. 配置环境变量

编辑 `.env.local`，填入你的 DeepSeek API Key：

```
DATABASE_URL="postgres://postgres:postgres@localhost:5432/docqa"
DEEPSEEK_API_KEY="sk-..."
```

### 3. 安装依赖

```bash
npm install --legacy-peer-deps
```

### 4. 运行数据库迁移

```bash
# 生成迁移文件
npx drizzle-kit generate

# 应用到数据库
npx drizzle-kit push
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

### 6. 验证环境

打开页面后，点击"🔌 测试连接"按钮，如果看到流式输出"👋 环境已就绪，AI 连接成功！"，说明环境搭建成功。

## 项目结构

```
├── app/
│   ├── api/
│   │   ├── upload/route.ts      # 文件上传处理
│   │   ├── chat/route.ts        # 问答流式接口
│   │   └── documents/route.ts   # 文档列表/删除
│   ├── layout.tsx               # 根布局
│   ├── page.tsx                 # 主界面
│   └── globals.css
├── components/                  # UI 组件
├── lib/
│   ├── db.ts                    # Drizzle 连接
│   ├── parser.ts                # 文档解析 + 分割
│   ├── embeddings.ts            # 向量化
│   ├── retriever.ts             # 检索逻辑
│   └── prompt.ts                # Prompt 模板
├── db/
│   ├── schema.ts                # 表结构定义
│   └── migrations/              # 迁移文件
├── docker-compose.yml           # 本地 pgvector
└── .env.local                   # 环境变量
```

## 开发路线

1. ✅ 环境搭建 (当前阶段)
2. 文件上传与解析
3. 文本分割与向量化
4. 基础问答接口 (RAG)
5. 流式改造
6. 前端溯源交互
7. 错误处理与美化
8. 多轮对话
9. 部署

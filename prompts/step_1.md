# 第一阶段任务：环境搭建与项目基础骨架

## 任务目标
完成项目初始化、本地开发环境配置、数据库表创建和基础 API 路由验证，确保应用能跑通一个最简单的“AI 调用 → 前端展示”流程。

---

## 具体任务

### 1. 初始化 Next.js 项目
- 使用 `create-next-app` 创建名为 `doc-qa-tracer` 的项目，配置 TypeScript + Tailwind CSS + ESLint
- 目录结构按照之前约定的规范创建空文件夹：
  - `app/api/upload/`
  - `app/api/chat/`
  - `app/api/documents/`
  - `components/`
  - `lib/`
  - `db/`
- 在根目录创建 `docker-compose.yml` 和 `.env.local`

### 2. 安装所有必需依赖
列出并安装以下包：
- `ai`（Vercel AI SDK）
- `@langchain/core`、`@langchain/openai`、`@langchain/community`
- `pg`、`drizzle-orm`、`@vercel/postgres`
- `pdf-parse`、`mammoth`
- `uuid`
- 开发依赖：`drizzle-kit`、`@types/pdf-parse`（如存在）

### 3. 配置本地 PostgreSQL + pgvector
- 提供 `docker-compose.yml` 内容，使用 `pgvector/pgvector:pg16` 镜像
- 端口 5432，数据库名 `docqa`，用户名/密码均为 `postgres`
- 配置 `volumes` 持久化数据

### 4. 设置环境变量
在 `.env.local` 中添加：
```
DATABASE_URL="postgres://postgres:postgres@localhost:5432/docqa"
OPENAI_API_KEY="在此填入你的 API Key"
```
并确保 `.env.local` 已在 `.gitignore` 中。

### 5. 定义数据库 Schema 并生成迁移
- 创建 `db/schema.ts`，按照之前提供的 Drizzle 代码定义 `documents` 和 `chunks` 表
- 配置 `drizzle.config.ts`，指向 `db/schema.ts` 和 `DATABASE_URL`
- 编写迁移脚本生成命令（`npx drizzle-kit generate:pg`）并执行迁移（`npx drizzle-kit push:pg` 或提供独立的 migrate 文件）

### 6. 创建数据库连接工具函数
- 创建 `lib/db.ts`，使用 `drizzle-orm/node-postgres` 或 `@vercel/postgres` 初始化连接并导出 `db` 实例

### 7. 实现一个最简单的 AI 调用验证流程
- 创建 `app/api/chat/route.ts`，使用 Vercel AI SDK 的 `OpenAIStream` 返回一句固定的测试消息：“👋 环境已就绪，AI 连接成功！”
- 实现流式响应
- 修改根页面 `app/page.tsx`，用 `useChat` hook 对接该 API，显示一个“测试连接”按钮，点击后流式展示返回文本

### 8. 提供启动指令
- 在 README.md 中写下：
  - `docker-compose up -d` 启动数据库
  - `npm run dev` 启动开发服务器
  - 如何运行数据库迁移

---

## 输出要求
- 所有文件必须带完整路径和代码
- 代码严格使用 TypeScript，遵循之前设定的开发原则
- 提供环境验证检查清单，说明如何确认每一步成功

---

## 验收检查清单（完成后自检）
- [ ] `docker-compose up -d` 后能通过 `pg` 客户端连接上 `docqa` 数据库
- [ ] `npm run dev` 成功启动，页面能打开
- [ ] 点击测试按钮后，页面能逐字显示“👋 环境已就绪，AI 连接成功！”
- [ ] `.env.local` 中已配置真实的 OpenAI Key，调用没有 401 错误
- [ ] `db/schema.ts` 中的表结构符合设计要求，迁移已执行（检查数据库可见两个表）

# 第八阶段任务：部署上线与 README 文档

## 任务目标
将项目部署到 Vercel，数据库迁移到 Supabase，编写一份完整的 README 文档。项目从本地开发环境变为公网可访问的线上产品。

---

## 前置条件
- 第七阶段完成，所有功能在本地运行稳定
- 代码已推送到 GitHub 仓库
- 已有 Vercel 账号（vercel.com）和 Supabase 账号（supabase.com）

---

## 任务拆解

### 1. 数据库迁移到 Supabase

#### 1.1 启用 pgvector
在 Supabase 项目的 SQL Editor 中执行：
```sql
create extension if not exists vector;
```

#### 1.2 更新数据库 Schema 中的向量维度检查
确认 `db/schema.ts` 中 `chunks.embedding` 的维度为 1024（与 BGE-M3 一致）。

#### 1.3 执行迁移
将本地 `.env.local` 的 `DATABASE_URL` 临时指向 Supabase 连接字符串，执行：
```bash
npx drizzle-kit push:pg
```
确认 `documents` 和 `chunks` 表在 Supabase 中已创建。之后可恢复本地数据库连接。

### 2. 准备部署配置

#### 2.1 确认 package.json 中的构建脚本
确保 `package.json` 包含：
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

#### 2.2 确认 next.config 无需特殊配置
Next.js 14+ App Router 在 Vercel 上开箱即用，无需修改 `next.config`，除非有特殊需求。

#### 2.3 确认 .gitignore 包含环境变量文件
`.gitignore` 中必须有：
```
.env
.env.local
.env*.local
```

### 3. 部署到 Vercel 的操作指引（供手动操作）

在 README 中写入以下部署步骤：

> **部署步骤**：
> 1. 在 Vercel 中导入 GitHub 仓库
> 2. 在项目设置中添加以下环境变量：
>    - `DATABASE_URL`：Supabase 提供的 PostgreSQL 连接字符串
>    - `SILICONFLOW_API_KEY`：硅基流动 API Key
>    - `LLM_API_KEY`：DeepSeek API Key
>    - `LLM_BASE_URL`：`https://api.deepseek.com/v1`
>    - `LLM_MODEL`：`deepseek-v4-flash`
> 3. 点击 Deploy，等待完成即可

### 4. 编写 README.md

**文件**: `README.md`

按以下模板编写（项目名称统一使用 CiteDoc）：

```markdown
# CiteDoc — Ask Documents, Get Cited Answers.

> 问文档，答有据。

CiteDoc 是一款可溯源智能文档问答工具。上传 PDF/Word 后自由提问，AI 的每一条回答都附带精确引用角标，点击即可跳转到原文对应位置并高亮——让每一条答案都有据可查。

## 功能特性
- 📄 支持 PDF 和 Word 文档上传与文本提取
- 🔍 语义向量检索（BAAI/bge-m3，1024 维）
- 💬 流式 AI 问答（DeepSeek）
- 📌 答案溯源角标，点击定位原文
- 🎯 原文段落精准高亮
- 💬 多轮对话，保持上下文
- 📱 响应式布局，移动端可用

## 技术栈
| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 14 (App Router) + TypeScript |
| 样式 | Tailwind CSS |
| LLM | DeepSeek（deepseek-v4-flash） |
| Embedding | BAAI/bge-m3（通过 SiliconFlow） |
| 向量数据库 | PostgreSQL + pgvector（Supabase） |
| ORM | Drizzle ORM |
| 部署 | Vercel + Supabase |

## 本地开发

### 前置要求
- Node.js 18+
- Docker（用于本地 pgvector）

### 安装与运行
\`\`\`bash
# 1. 克隆仓库
git clone https://github.com/yourname/citedoc.git
cd citedoc

# 2. 安装依赖
npm install

# 3. 启动本地数据库
docker-compose up -d

# 4. 配置环境变量（创建 .env.local）
# DATABASE_URL="postgres://postgres:postgres@localhost:5432/docqa"
# SILICONFLOW_API_KEY="sk-xxx"
# LLM_API_KEY="sk-xxx"
# LLM_BASE_URL="https://api.deepseek.com/v1"
# LLM_MODEL="deepseek-v4-flash"

# 5. 执行数据库迁移
npx drizzle-kit push:pg

# 6. 启动开发服务器
npm run dev
\`\`\`

访问 http://localhost:3000

## 项目架构
\`\`\`
上传文档 → 解析文本（保留字符偏移+页码） → 滑动窗口切分 → BGE-M3 向量化 → 存入 pgvector
                                                                              ↓
提问 → 问题向量化 → 余弦相似度检索 top K → 构建 Prompt → DeepSeek 生成带引用答案
                                                                              ↓
                                                     解析引用 → SSE 流式推送 → 前端逐字展示 + 角标可点击
                                                                              ↓
                                                             点击角标 → 原文滚动高亮
\`\`\`

## 关键设计
- **自定义文本分割器**：保留每个 chunk 的字符偏移和页码，实现精准溯源
- **先完整生成后流式推送**：确保引用标记解析正确，避免流式状态下解析错误
- **pgvector 替代独立向量库**：减少依赖，数据集中管理，便于混合检索扩展
- **国内模型服务**：SiliconFlow + DeepSeek，有免费额度，API 兼容 OpenAI 格式

## 部署
项目可一键部署到 Vercel：

1. 在 Vercel 中导入 GitHub 仓库
2. 配置环境变量（见本地开发中的环境变量列表，将 DATABASE_URL 改为 Supabase 连接字符串）
3. 在 Supabase SQL Editor 中执行 `create extension if not exists vector;`
4. 执行数据库迁移：`npx drizzle-kit push:pg`（指向 Supabase）
5. 点击 Deploy

## License
MIT
```

### 5. 可选优化（如时间允许）

#### 5.1 更新项目 metadata
在 `app/layout.tsx` 中设置：
```ts
export const metadata = {
  title: 'CiteDoc — Ask Documents, Get Cited Answers.',
  description: '可溯源智能文档问答工具。上传文档，提问，追溯每一条答案的原文出处。',
};
```

#### 5.2 添加 Open Graph 图片
创建 `/public/og-image.png`，在 layout 中引用，便于社交媒体分享时展示缩略图。

#### 5.3 首页空状态优化
确保首页在没有文档时展示清晰的引导 UI：图标 + “上传文档开始提问”提示。

---

## 验收检查清单
- [ ] Supabase 数据库已配置，pgvector 扩展已启用
- [ ] 数据库表结构与本地一致
- [ ] README.md 内容完整，项目名称为 CiteDoc
- [ ] 部署到 Vercel 的操作指引清晰
- [ ] 项目 metadata 已设置（标题、描述）
- [ ] 首页空状态有引导提示

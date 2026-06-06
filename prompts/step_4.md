# 第四阶段任务：向量化与存储（免费国内嵌入模型）

## 任务目标
将第三阶段切分好的文档块，使用国内免费可用的 Embedding 模型生成向量，并写入 pgvector，使文档块可被语义检索。使用硅基流动 SiliconFlow 的 `BAAI/bge-m3` 模型（1024 维，免费额度充足）。

完成后，所有 chunk 携带语义向量，为第五阶段问答检索做好准备。

---

## 前置条件
- 第三阶段完成，`chunks` 表中已有记录，且 `embedding` 字段类型为 `vector(1024)`（**必须确保维度 1024**）
- 已注册 SiliconFlow 账号并获取 API Key：https://siliconflow.cn
- 环境变量已配置 `SILICONFLOW_API_KEY`（免费额度，足够 MVP 使用）
- `openai` 包已安装（SiliconFlow 接口兼容 OpenAI 格式）

---

## ⚠️ 数据库维度检查
`chunks.embedding` 必须设置为 `vector(1024)`。如果你之前用 1536 维，需要调整：

**方案 A（无重要数据时）**
```sql
DROP TABLE IF EXISTS chunks;
```
然后修改 `db/schema.ts` 中 `embedding: vector('embedding', { dimensions: 1024 })`，重新运行迁移。

**方案 B（保留数据）**
```sql
UPDATE chunks SET embedding = NULL;
ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(1024);
```

确认 `db/schema.ts` 维度已改，运行迁移确保表结构正确。

---

## 核心设计决策
- **模型选择**：`BAAI/bge-m3`，免费，支持中英文，最大输入 8192 token，1024 维稠密向量。检索质量优于许多同级模型。
- **API 接入**：使用 `openai` 客户端，baseURL 指向 `https://api.siliconflow.cn/v1`，无需额外 SDK。
- **批量处理**：每批最多 20 条，失败重试 2 次（指数退避）。
- **幂等性**：自动跳过已有 embedding 的 chunk。

---

## 任务拆解

### 1. 更新环境变量
`.env.local` 添加：
```
SILICONFLOW_API_KEY="sk-你的key"
```

### 2. 确认数据库 Schema
`db/schema.ts` 中：
```ts
embedding: vector('embedding', { dimensions: 1024 }),
```
重新生成迁移（如未改）：
```bash
npx drizzle-kit generate:pg
npx drizzle-kit push:pg
```

### 3. 创建向量化模块
**文件**: `lib/embeddings.ts`

```ts
import OpenAI from 'openai';
import { db } from './db';
import { chunks } from '@/db/schema';
import { eq, isNull, isNotNull, sql } from 'drizzle-orm';

const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: 'https://api.siliconflow.cn/v1',
});

const EMBEDDING_MODEL = 'BAAI/bge-m3';
const BATCH_SIZE = 20;
const MAX_RETRIES = 2;

export interface EmbeddingResult {
  chunkId: string;
  success: boolean;
  error?: string;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return response.data.map(d => d.embedding);
}

export async function embedChunks(
  documentId?: string
): Promise<EmbeddingResult[]> {
  let query = db.select().from(chunks).where(isNull(chunks.embedding));
  if (documentId) {
    query = query.where(eq(chunks.documentId, documentId));
  }
  const pendingChunks = await query;
  if (pendingChunks.length === 0) return [];

  const results: EmbeddingResult[] = [];

  for (let i = 0; i < pendingChunks.length; i += BATCH_SIZE) {
    const batch = pendingChunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.content);

    let embeddings: number[][] | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        embeddings = await embedBatch(texts);
        break;
      } catch (err: any) {
        if (attempt === MAX_RETRIES) {
          batch.forEach(c => {
            results.push({ chunkId: c.id, success: false, error: err.message });
          });
        } else {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    if (embeddings) {
      for (let j = 0; j < batch.length; j++) {
        try {
          const vectorLiteral = `[${embeddings[j].join(',')}]`;
          await db.update(chunks)
            .set({ embedding: sql`${vectorLiteral}::vector` })
            .where(eq(chunks.id, batch[j].id));
          results.push({ chunkId: batch[j].id, success: true });
        } catch (err: any) {
          results.push({ chunkId: batch[j].id, success: false, error: err.message });
        }
      }
    }
  }

  return results;
}

// 进度查询
export async function getEmbeddingProgress(documentId: string) {
  const total = await db.select({ count: sql<number>`count(*)` })
    .from(chunks).where(eq(chunks.documentId, documentId));
  const embedded = await db.select({ count: sql<number>`count(*)` })
    .from(chunks)
    .where(eq(chunks.documentId, documentId))
    .where(isNotNull(chunks.embedding));
  return { total: total[0].count, embedded: embedded[0].count };
}
```

### 4. API 路由
**文件**: `app/api/documents/[id]/embed/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { embedChunks, getEmbeddingProgress } from '@/lib/embeddings';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const results = await embedChunks(params.id);
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.length - successCount;
    const failedIds = results.filter(r => !r.success).map(r => r.chunkId);

    return NextResponse.json({
      total: results.length,
      success: successCount,
      failed: failedCount,
      failedIds,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || '向量化失败' },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const progress = await getEmbeddingProgress(params.id);
  return NextResponse.json(progress);
}
```

### 5. 测试与验证
1. 上传文档 → `chunks` 表有记录且 embedding 为空。
2. 调用 `POST /api/documents/{id}/embed`，返回 success 数量等于 chunk 总数。
3. 数据库查看 embedding 列不为 null，维度为 1024。
4. 运行相似度查询验证语义检索能力。
5. 再次调用 embed，返回 `success: 0`（幂等）。

---

## 验收检查清单
- [ ] `SILICONFLOW_API_KEY` 正确配置，调用无鉴权错误
- [ ] `chunks` 表 embedding 维度 1024
- [ ] 向量化 API 正常工作，进度可查询
- [ ] 相似度查询能返回语义相关结果
- [ ] 幂等性验证通过

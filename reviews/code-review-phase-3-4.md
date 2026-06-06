# Code Review: Phase 3-4（文本切分 + 向量化）

> **审查日期**: 2026-06-06 | **审查范围**: 8 个源文件
> **审查标准**: role.md（TypeScript strict、禁止 any、完整错误处理、模块化）

---

## 总览

| 严重度 | 数量 |
|--------|------|
| 🔴 Critical | 1 |
| 🟡 High | 2 |
| 🟢 Medium | 5 |
| ⚪ Low | 5 |

---

## 综合评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 类型安全 | ⚠️ 7 | `getEmbeddingProgress` 返回类型不一致（number vs string）|
| 错误处理 | ⚠️ 7 | embed API 缺少文档存在性校验，upload DB 写入无事务 |
| 核心算法 | ✅ 8 | 滑动窗口 + 自然断点逻辑正确，但 findNaturalBreak 重复过滤 |
| 代码组织 | ✅ 9 | 模块化清晰，注释完整 |
| 数据库 | ⚠️ 7 | embeddings 缺少超时，类型注释需更新 |
| 幂等性 | ✅ 9 | 设计正确，已验证 |

---

## 🔴 Critical

### C-1. `getEmbeddingProgress` 返回值类型不一致

- **文件**: [lib/embeddings.ts:162-181](lib/embeddings.ts#L162-L181)
- **问题**: 函数签名声明返回 `{ total: number, embedded: number }`，但 `sql<number>` 在运行时 PostgreSQL 返回的 count 是 **字符串**（如 `"3"` 而非 `3`）。curl 已验证：`"total":"3"`。
- **影响**: 前端如果用 `===` 严格比较数字会失败。如果用作计算（如 `total - embedded`）会产生隐式字符串拼接。
- **修复**: 使用 `Number()` 显式转换：
  ```ts
  return {
    total: Number(totalRow?.count ?? 0),
    embedded: Number(embeddedRow?.count ?? 0),
  };
  ```

---

## 🟡 High

### H-1. embed API 不校验文档是否存在

- **文件**: [app/api/documents/[id]/embed/route.ts:15](app/api/documents/[id]/embed/route.ts#L15)
- **问题**: `POST` 和 `GET` 端点都直接将 `documentId` 传给 `embedChunks`/`getEmbeddingProgress`，不检查文档是否存在。当传入不存在的 UUID 时，返回 `total: 0` 而非 404。
- **影响**: 调用方收到 200 + `total:0`，无法区分"文档不存在"和"文档无 chunk"。
- **修复**: 在 `embedChunks` 调用前增加文档存在性检查（参考 `chunks/route.ts` 的做法）。

### H-2. embed API 缺少 concurrency protection

- **文件**: [app/api/documents/[id]/embed/route.ts:14](app/api/documents/[id]/embed/route.ts#L14)
- **问题**: 原 design 中决策了内存 Set 并发锁（D5），但简化需求后移除了。如果用户快速连点两次 POST，两次调用可能同时查询到相同的 pending chunks，导致重复调用 API 和重复写入。
- **影响**: 重复 API 调用 → 浪费 SiliconFlow 额度；重复 DB 写入 → 虽然不报错但浪费时间。
- **修复**: 至少加上简单的内存锁（设计文档中已有的方案）。

---

## 🟢 Medium

### M-1. `findNaturalBreak` 重复过滤 NATURAL_BREAKS

- **文件**: [lib/splitter.ts:69-70](lib/splitter.ts#L69-L70)
- **问题**: 每个 chunk 调用 `findNaturalBreak` 时，`NATURAL_BREAKS.filter()` 在外层 for 循环中每次迭代都执行一次（共 6 次）。对于 100 个 chunk 的文档，总计 600 次无意义的 filter 调用。
- **影响**: 性能浪费——NATURAL_BREAKS 是常量，不需要每次过滤。
- **修复**: 在模块顶层按 priority 预分组：
  ```ts
  const BREAKS_BY_PRIORITY = new Map<number, string[]>();
  for (const b of NATURAL_BREAKS) {
    if (!BREAKS_BY_PRIORITY.has(b.priority)) BREAKS_BY_PRIORITY.set(b.priority, []);
    BREAKS_BY_PRIORITY.get(b.priority)!.push(b.pattern);
  }
  ```

### M-2. `embedBatch` 无超时控制

- **文件**: [lib/embeddings.ts:41-48](lib/embeddings.ts#L41-L48)
- **问题**: OpenAI SDK 调用无 timeout 参数。若 SiliconFlow 服务无响应，请求会一直挂起直到 Node.js 默认超时（通常 2 分钟）。
- **影响**: 长时间挂起消耗连接池资源，用户体验差。
- **修复**: 传递 `timeout: 30000` 到 `client.embeddings.create()` 或用 `AbortController`。

### M-3. upload route 中文档入库和 chunk 入库无事务保护

- **文件**: [app/api/upload/route.ts:73-101](app/api/upload/route.ts#L73-L101)
- **问题**: 文档 INSERT 成功但 chunks INSERT 失败时，documents 表有记录但 chunks 表为空。这是已知的 review M-4 仍未修复。
- **影响**: 孤立文档记录，前端展示成功但无法向量化/检索。
- **修复**: 后续考虑用 Drizzle 事务或异步两步流程。

### M-4. `splitTextWithMeta` 中 fullText 末尾多余空格

- **文件**: [lib/splitter.ts:143-144](lib/splitter.ts#L143-L144)
- **问题**: 每个 segment 后无条件追加空格 `fullText += " "`，包括最后一个 segment。导致 `fullText` 末尾有一个多余空格，且 chunk 的 `charEnd` 可能指向这个空格。
- **影响**: 最后一个 chunk 的 `content` 末尾可能包含多余空格；溯源高亮时可能多选一个空格字符。
- **修复**: 仅在非最后 segment 时追加空格：
  ```ts
  fullText += seg.content;
  if (i < sorted.length - 1) {
    fullText += " ";
  }
  ```

### M-5. `lookupPage` 默认返回 page=1 无警告

- **文件**: [lib/splitter.ts:148-158](lib/splitter.ts#L148-L158)
- **问题**: 当 `charPosition < 0` 或 pageMap 为空时，函数静默返回 page=1。这可能隐藏调用方传递了无效偏移量的 bug。
- **影响**: 错误位置的数据显示为 page 1，难以调试。
- **修复**: pageMap 为空时 console.warn；charPosition < 0 时返回 1 并 warn。

---

## ⚪ Low

### L-1. db/schema.ts 向量维度注释过时

- **文件**: [db/schema.ts:34](db/schema.ts#L34)
- **问题**: 注释写的是 "1536 维向量 (OpenAI text-embedding-ada-002)"，实际已改为 1024 维 BAAI/bge-m3。
- **修复**: 更新注释为 "1024 维向量 (SiliconFlow BAAI/bge-m3)"。

### L-2. chunks route 中 `parsedMetadata: unknown` 类型

- **文件**: [app/api/documents/[id]/chunks/route.ts:51](app/api/documents/[id]/chunks/route.ts#L51)
- **问题**: 变量类型为 `unknown`，虽然不影响运行但在 TypeScript strict 下不够规范。
- **修复**: 定义为 `Record<string, unknown>` 或导入 `ChunkMetadata` 类型。

### L-3. upload route 中 chunk 逐条 INSERT 效率低

- **文件**: [app/api/upload/route.ts:91-97](app/api/upload/route.ts#L91-L97)
- **问题**: 循环内逐条 `await db.insert()`，每个 chunk 一次数据库往返。10 个 chunk = 10 次网络往返。
- **影响**: 大文档上传延迟增加（MV 可接受）。
- **修复**: 使用 Drizzle 的 `db.insert(chunks).values([...])` 批量插入。

### L-4. `getClient()` 非线程安全

- **文件**: [lib/embeddings.ts:9-17](lib/embeddings.ts#L9-L17)
- **问题**: `if (!_client)` + `_client = new OpenAI()` 存在竞态条件——两个并发请求可能同时创建两个不同的客户端实例。
- **影响**: 极低——多创建一个 OpenAI 客户端对象不会造成功能问题，只是轻微内存浪费。
- **修复**: 模块顶层直接初始化（延迟初始化的收益很小，因为只在首次 API 调用时创建）。

### L-5. 前端 FileUpload 仍缺少 fetch 超时

- **文件**: [components/FileUpload.tsx:36-39](components/FileUpload.tsx#L36-L39)
- **问题**: 这是已知的 review L-2 未修复——大文件上传超时时用户永远看到"上传中..."。
- **修复**: 添加 `AbortController` 30s 超时。

---

## 已验证通过的项 ✅

以下从上次 review 修复后保持不变：
- `parsePdf` 渐进构建 fullText ✓
- `validateSegments` 自验证 ✓
- pdf-parse Uint8Array 转换 ✓
- TypeScript strict 无 `any` ✓（除 L-2 的 `unknown` 外）
- API 路由 try-catch 完整 ✓
- 幂等设计正确且已验证 ✓

---

## 优先修复建议

| 优先级 | 编号 | 问题 | 预计耗时 |
|--------|------|------|---------|
| 1 | C-1 | `getEmbeddingProgress` 类型不一致 | 2 min |
| 2 | H-1 | embed API 缺少文档存在性校验 | 5 min |
| 3 | H-2 | embed API 缺少并发保护 | 5 min |
| 4 | M-1 | NATURAL_BREAKS 重复过滤优化 | 5 min |
| 5 | M-4 | fullText 末尾多余空格 | 2 min |

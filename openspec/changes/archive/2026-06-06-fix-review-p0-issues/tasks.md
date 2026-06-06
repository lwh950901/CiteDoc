## 1. Type Fix — `getEmbeddingProgress`

- [x] 1.1 在 `lib/embeddings.ts` 的 `getEmbeddingProgress` 函数 return 语句中用 `Number()` 包装 `totalRow?.count` 和 `embeddedRow?.count`，确保返回值类型为 `number`

## 2. Embed API Fixes — `app/api/documents/[id]/embed/route.ts`

- [x] 2.1 POST 端点增加文档存在性校验：查询 `documents` 表，不存在时返回 404 `{ error: "文档不存在" }`
- [x] 2.2 GET 端点增加文档存在性校验：查询 `documents` 表，不存在时返回 404 `{ error: "文档不存在" }`
- [x] 2.3 POST 端点增加内存并发锁：模块级别 `Set<string>`，同一文档 ID 并发请求返回 409 Conflict，`finally` 中释放锁

## 3. Verification

- [x] 3.1 运行 `npx tsc --noEmit` 确保无新增类型错误
- [x] 3.2 通过 curl 验证 `GET /api/documents/:id/embed` 返回的 `total`/`embedded` 为 JSON number 类型（非字符串）
- [x] 3.3 通过 curl 验证对不存在文档 ID 的 POST/GET 请求返回 404
- [x] 3.4 通过 curl 验证并发 POST 锁行为（快速连续两次 POST 同一文档，第二次返回 409）

# Tasks: Phase 3 - Text Splitting

## 1. Core Splitter Module

- [x] 1.1 创建 `lib/splitter.ts`，定义类型接口 `ChunkWithMeta`、`SplitterOptions`
- [x] 1.2 实现 `splitTextWithMeta()` 函数主体：滑动窗口 + 自然断点搜索 + 页码映射
- [x] 1.3 实现边界处理：空 segments 返回 `[]`、无效参数抛 Error、超长段落硬切兜底
- [x] 1.4 创建 `lib/index.ts` 统一导出 `Splitter` 相关类型

## 2. Upload Route Integration

- [x] 2.1 修改 `app/api/upload/route.ts`：解析成功后调用 `splitTextWithMeta` 生成 chunks
- [x] 2.2 实现 chunks 批量写入 `chunks` 表（embedding 为 NULL）
- [x] 2.3 响应 JSON 中新增 `chunkCount` 字段

## 3. Chunk Debug API

- [x] 3.1 创建 `app/api/documents/[id]/chunks/route.ts`：GET 接口按文档 ID 查询 chunks
- [x] 3.2 实现 content 截断逻辑（> 100 字符加 `"..."`）
- [x] 3.3 处理边界：文档不存在（404）、无 chunks（空数组 `[]`）

## 4. Validation & Testing

- [x] 4.1 用模拟 segments 手动验证 `splitTextWithMeta` 输出正确性（数量、偏移量、重叠）
- [x] 4.2 通过 `curl` 上传测试 PDF 并验证 `chunkCount` 出现在响应中
- [x] 4.3 调用 `GET /api/documents/:id/chunks` 确认返回 chunk 列表且不含 embedding
- [x] 4.4 数据库直接查询 chunks 表验证 `metadata` JSON 字段完整

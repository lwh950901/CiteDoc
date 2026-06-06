# Design: Phase 3 - Text Splitting

## Context

Phase 2 的 `parseDocument` 输出 `fullText` + `segments`（段落级元数据）。Phase 3 需要将大文档切成适合向量检索的 chunks，同时保留字符级位置元数据以便前端溯源高亮。

当前 `chunks` 表已在 Phase 1 建好，字段包括 `documentId`、`content`、`embedding`（向量）、`metadata`（JSONB 文本）。Phase 3 只填充 `content` 和 `metadata`，embedding 留空给 Phase 4。

**核心约束**：LangChain 的 `RecursiveCharacterTextSplitter` 只输出文本块字符串，丢弃原文位置信息——这意味着切完后无法回溯到原文字符偏移，溯源码关系直接断裂。必须自研。

## Goals / Non-Goals

**Goals:**
- 实现滑动窗口文本切分器，每个 chunk 携带 `{ page, charStart, charEnd }` 元数据
- 上传文档后自动切分并存入 `chunks` 表
- 提供简单的 chunk 调试接口验证切分效果

**Non-Goals:**
- 不实现向量化（Phase 4）
- 不支持语义分块（如按主题切分），仅支持长度驱动的滑动窗口
- 不做 sentence embedding、不做 LLM-based chunking
- 不分批/异步处理（上传后同步切分，阻塞响应）

## Decisions

### D1: 渐进拼接 + 位置追踪（与 parsePdf 相同策略）

**选择**: 将 segments 按 `charStart` 排序后，渐进拼接构建 `fullText`（已是 Phase 2 输出），同时维护一个 `pageMap` 数组——每个 segment 在 fullText 中的起始偏移量映射到其页码。切分时，chunk 的 `charStart`/`charEnd` 直接从 fullText 位置计算。

**替代方案**:
- 在切分后才反查页码（`findSegmentByOffset` 二分查找）：复杂度高，不如构建 pageMap 直接。
- 信任 segments 已有的 `charStart`/`charEnd`：可简化，但 segment 间可能存在分隔符间隙，直接引用会导致 chunk 偏移与原文对不上。

**选择理由**: 与 Phase 2 `parsePdf` 的渐进构建策略一致——偏移量由构建过程保证正确，无需事后校验。

### D2: 自然断点优先切分

**选择**: 滑动窗口在 `chunkSize` 附近按优先级搜索自然断点：`\n\n`（段落分隔）→ `。` / `；`（中文句尾）→ `\n`（换行）→ `.`（英文句尾）。找不到时在 `chunkSize` 处精确硬切。

**替代方案**:
- 仅按 `chunkSize` 精确硬切：简单但语义完整性差，经常把句子拦腰截断。
- 用 tiktoken tokenizer 按 token 数切分：支持 token-based chunking，但字符偏移在 token 和字符间转换复杂且可能丢失精度。

**选择理由**: 中文/英文混合文档在自然断点处切分语义损失最小，且不依赖外部 tokenizer。

### D3: Chunk 页码映射策略

**选择**: 每个 chunk 的 `page` 字段取其起始 `charStart` 位置在 `pageMap` 中对应的段落页码。chunk 跨页时取起始页。

**替代方案**:
- 记录 `{ startPage, endPage }`：更精确但复杂度高，前端溯源时只需要起始页来定位。
- 不记录页码：MVP 阶段 Word 单页文档无所谓，但 PDF 多页时必须。

**选择理由**: MVP 阶段取起始页足够，后续可扩展为 `pageRange`。

### D4: Chunk 入库策略 — 同步顺序插入

**选择**: 上传 API 中，文档解析完成后，同步调用 `splitTextWithMeta()`，再逐条 `INSERT` 到 `chunks` 表。

**替代方案**:
- 批量 INSERT（`db.insert(chunks).values([...])`）: 更快但 Drizzle ORM 默认不支持批量 returning，且错误处理粒度太粗——一条失败全失败。
- 异步后台处理：上传立即返回，后台切分+入库。体验更好但增加系统复杂度（需要任务队列/状态轮询）。

**选择理由**: MVP 阶段文档不大（< 10MB），同步插入耗时可接受（通常 < 1s）。Phase 4 向量化时再评估是否需要异步流水线。

### D5: Metadata 存储格式

**选择**: `chunks.metadata` 列为 `text` 类型，存入 `JSON.stringify(chunk.metadata)`。字段包含 `{ documentId, page, charStart, charEnd }`。

**替代方案**:
- 将 `page`、`charStart`、`charEnd` 作为 `chunks` 表的独立列：查询更方便（可直接 WHERE 过滤），但 Phase 1 已建好表结构，改 schema 成本高。
- 使用 PostgreSQL JSONB：支持 JSON 路径查询，比 text 更灵活。但 pgvector 镜像已配置，Drizzle 的 vector 类型与 JSONB 混用可能增加迁移复杂度。

**选择理由**: 复用 Phase 1 schema，JSON text 存储足够灵活，后续可迁移为 JSONB。

### D6: 超长段落处理

**选择**: 单个 segment 内容超过 `chunkSize` 2 倍时，在 segment 内部强制按 `chunkSize` 硬切（不等待自然断点），`console.warn` 记录。

**替代方案**:
- 始终只在自然断点处切分：超长段落无自然断点时可能无限期不切分。
- 递归切分超长段落直到每个子段小于 chunkSize。

**选择理由**: 以简单为主，硬切是兜底策略，不会死循环。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| **Overlap 造成语义重复**：相邻 chunk 重叠部分在检索时可能返回重复内容 | Phase 5 检索时按 `charStart` 去重或前端合并相邻 chunk |
| **同步切分阻塞上传响应**：大文档（10MB）切分耗时可能 > 2s | MVP 文档 < 10MB 通常 < 1s；后续异步化 |
| **chunk 跨越段落导致页码不精确** | MVP 取起始页；后续改为 `pageRange` |
| **中文标点作为断点不够全面**（如 `！`、`？`） | 断点列表可配置，后续按需扩展 |
| **与 document-upload-parse change 存在时序依赖**：该 change 的 upload route 也在开发中 | 两者修改同一文件；Phase 3 以当前 main 分支的 upload route 为基础，冲突在合并时处理 |

# Proposal: Phase 3 - Text Splitting with Source Tracing Metadata

## Why

Phase 2 已实现文档上传和解析，输出 `fullText` + `segments`（段落级字符偏移元数据）。但检索增强生成（RAG）需要将文档切成更小的文本块进行向量化和语义匹配，而 LangChain 等现成工具在切分时会丢弃原文位置信息——没有位置信息，答案溯源就无从实现。Phase 3 必须在切分时**保留每个 chunk 的字符偏移区间**，确保下一阶段的溯源交互有可靠的位置元数据。

## What Changes

- 新增 `lib/splitter.ts` 文本切分模块：滑动窗口 + 自然断点优先切分，每个 chunk 携带 `{ documentId, page, charStart, charEnd }` 元数据
- 改造 `app/api/upload/route.ts`：文档解析后自动调用切分器，将 chunks 写入 `chunks` 表（embedding 暂为 NULL，留给 Phase 4 向量化）
- 新增 `GET /api/documents/:id/chunks` 调试接口：返回指定文档所有 chunk 的摘要（不含 embedding 向量），用于验证切分效果
- 故意不引入 LangChain RecursiveCharacterTextSplitter：它不保留字符偏移量，无法溯源

## Capabilities

### New Capabilities
- `text-splitting`: 自研滑动窗口文本切分器，保留字符偏移和页码元数据，支持自然断点优先切分
- `chunk-api`: 调试用 chunk 查询接口，按文档 ID 返回 chunk 列表摘要

### Modified Capabilities
- `document-upload`: 上传路由在文档解析存入 `documents` 表后，新增切分逻辑 → 写入 `chunks` 表，响应增加 `chunkCount` 字段

## Impact

- `lib/splitter.ts`: 新增，文本切分核心逻辑 + 类型定义
- `app/api/upload/route.ts`: 改造，集成切分 + chunks 入库
- `app/api/documents/[id]/chunks/route.ts`: 新增，chunk 调试接口
- `db/schema.ts`: 已有，无需修改（chunks 表已在 Phase 1 建好）
- `lib/parser.ts`: 引用已有类型（`Segment`），不修改

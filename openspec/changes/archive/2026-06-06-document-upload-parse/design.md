# Design: Document Upload & Parse

## Context

第一阶段已完成环境搭建，`documents` 表和 `chunks` 表就绪。现在需要实现文档上传入口和文本提取核心逻辑。这是整个溯源链路的起点——没有精确的位置元数据，后续的向量检索和答案高亮都无法定位到原文位置。

**约束**：第一阶段用了 `drizzle-orm/node-postgres`（pg 驱动），所有 DB 操作沿袭此方案。

## Goals / Non-Goals

**Goals:**
- 统一的 `parseDocument` 函数，根据 MIME 类型自动分发到 PDF/Word 解析器
- PDF 解析保留页码和字符偏移，Word 解析保留字符偏移（MVP 视为单页）
- 上传 API 具备完整的类型校验、大小限制和错误处理
- 前端上传组件覆盖四种 UI 状态（idle/uploading/success/error）
- 解析结果写入 `documents` 表，segments 通过 API 返回

**Non-Goals:**
- 不在此阶段插入 `chunks` 表（留给第三阶段文本分割 + 向量化）
- 不支持 PDF 以外的格式的页码检测（如 Word 页码留给后续优化）
- 不做拖拽上传（MVP 用简单 input）

## Decisions

### Decision 1: Parser 按 MIME 类型分发

```ts
function parseDocument(buffer: Buffer, mimeType: string): Promise<ParseResult> {
  if (mimeType === "application/pdf") return parsePdf(buffer);
  if (mimeType.includes("wordprocessingml")) return parseWord(buffer);
  throw new Error("Unsupported file type");
}
```

**理由**：单一入口函数，上层 API 调用方无需关心文件类型细节。函数签名清晰，后续加新格式（如 .txt、.epub）只需加分支。

**替代方案考虑**：策略模式（Parser 类）—— MVP 场景下函数即够用，过度设计。

### Decision 2: 按自然段落分割

PDF 段落分割：按两个及以上连续换行符 `\n\s*\n` 切分。
Word 段落分割：按换行符切分，过滤空段。

**理由**：保持语义完整性。按自然段分割比按固定长度分割更能保证后续 RAG 检索时每个 chunk 表达完整的意思。

### Decision 3: MVP 阶段 Word 页码为 1

mammoth 不提供页码信息。MVP 阶段将整个 Word 文档的 `page` 统一设为 1，字符偏移仍然按段落正确记录。

**理由**：溯源跳转的核心是字符偏移，页码为辅助信息。Word 文档通常较短，按全文跳转体验可接受。

### Decision 4: API 返回 segments 但不持久化

本次 API 响应中包含所有 `segments` 数据，但只将 `fullText` 存入 `documents` 表。segments 暂不存表（留给第三阶段切分后再存 `chunks`）。

**理由**：
- segments 数据量大（大文档可能有几百个段落），存在 `documents` 表中需加 JSON 列
- 第三阶段会对 segments 做滑动窗口切分生成 chunks，到时 segments 作为中间数据没必要持久化
- API 返回 segments 给前端展示预览已足够

### Decision 5: 错误处理分层

```
前端 fetch → 网络/HTTP 错误捕获
API 层 try-catch → 文件校验错误 400/413，解析错误 500
Parser 层 throw → 加密/损坏检测
```

每层职责明确，不跨层处理。

## Risks / Trade-offs

- **[风险] pdf-parse 对特殊格式 PDF（扫描版、加密）支持有限** → 用 try-catch 捕获，返回友好错误提示
- **[取舍] Word 页码精度不足** → MVP 接受，后续可换用 `word-extractor` 等更高级的库
- **[风险] 大文件（~10MB）解析耗时** → 前端 loading 态 + 超时设置；上传用 FormData 流式，不占内存

# Design: Fix Code Review P0 Issues

## Context

当前 `parsePdf` 的段落偏移量计算采用手动累加方式（`globalOffset = end + 1`），假设段落间分隔符长度为 1。但实际上 `splitIntoParagraphs` 使用 `/\n\s*\n/` 分割，分隔符至少 2 个字符。此外 `pdfParse` 被调用两次——第一次获取元数据，第二次仅为 pagerender 副作用。pagerender 回调内部使用三层 `as` 强制断言，无运行时守卫。

本次修复仅涉及 `lib/parser.ts`（核心）和 `app/api/upload/route.ts`（类型标注），不改变 API 契约和数据库 schema。

## Goals / Non-Goals

**Goals:**
- 修复 PDF 段落的 charStart/charEnd 与 fullText 严格对应
- 消除 PDF 双次解析
- 替换不安全类型断言为接口定义 + 运行时守卫
- pagerender 回退方案提供合理的页码近似
- 解析完成后执行自验证，开发阶段尽早暴露偏移量错误

**Non-Goals:**
- 不修改 `parseWord`（已使用正确 indexOf 方案）
- 不修改数据库 schema（segments 持久化留到后续阶段）
- 不修改 API 响应 shape 和前端组件

## Decisions

### D1: 偏移量计算：渐进构建 fullText（替代 indexOf 查找）

**选择：** 在构建 fullText 的同时计算偏移量，而非先构建 fullText 再用 indexOf 查找。

**实现方式：**
```
pageText → splitIntoParagraphs → ["第一章\n简介", "这是第一段。"]
                                  ↓
fullTextParts = ["第一章\n简介", "这是第一段。"]
fullText = fullTextParts.join("\n\n")  // 段落间用 \n\n 连接

offset = 0
for each part:
  charStart = offset
  charEnd = offset + part.length
  offset = charEnd + 2  // \n\n = 2 chars
```

页面之间用 `\n` 连接（`pageTexts.join("\n")`），在构建 fullText 时统一处理。

**对比方案：**

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| A: indexOf 查找（parseWord 方案） | 简单，不改变 fullText 结构 | O(n*m) 复杂度；段落重复文本可能匹配错误 | ❌ |
| B: 计算精确分隔符长度 | 保留原始 fullText 格式 | 需追踪 splitIntoParagraphs 的匹配结果，实现复杂 | ❌ |
| C: **渐进构建 fullText** | **偏移量由构造保证正确，O(n) 复杂度，无匹配歧义** | fullText 格式变为规范化（段落间统一 `\n\n`） | ✅ |

**风险缓解：** fullText 格式变化不影响下游——chunking 和 embedding 对空白字符不敏感，且规范化格式更利于后续分段。

### D2: 消除双解析：合并 pagerender 到首次调用

**选择：** 将 `pagerender` 回调作为选项传入唯一的 `pdfParse` 调用，从返回值同时获取 `data`（text + numpages）和 pagerender 副作用（pageContents）。

```
const data = await pdfParse(fileBuffer, {
  pagerender: function (pageData) { ... }
});
// data.text, data.numpages 可用
// pageContents 通过闭包收集
```

无替代方案需要比较——当前双调用是明确的反模式，合并是唯一正确做法。

### D3: 类型安全：定义 pdf-parse 内部接口

**选择：** 在 parser.ts 内部定义 `PDFTextItem` 和 `PDFPageData` 接口，替代 `as` 断言：

```ts
interface PDFTextItem {
  str: string;
  transform?: number[];
}

interface PDFPageData {
  getTextContent: () => Promise<{ items: PDFTextItem[] }>;
}
```

pagerender 回调中仅需一次类型守卫（`typeof pageData.getTextContent === 'function'`），内部访问通过已定义接口。

**不使用 @types/pdf-parse 的补充类型**——因为 @types/pdf-parse 只声明了顶层 API，不包含内部 pagerender 回调的类型。

### D4: 回退方案页码分配

**选择：** 利用已知的 `data.numpages` 做均匀分配：

```ts
const estimatedPage = Math.ceil((i + 1) * data.numpages / segments.length);
```

**同时添加 `console.warn`** 提示发生了降级，便于调试。

**替代方案：** 抛出错误拒绝解析——过于严格，因为 pagerender 失败不代表文档无法使用（文本内容仍然完整）。

### D5: 自验证断言

**选择：** 添加内部函数 `validateSegments(segments, fullText)`，在 `parsePdf` 返回前调用：

```ts
function validateSegments(segments: Segment[], fullText: string): void {
  // 1. 按 charStart 排序
  // 2. 验证无重叠（seg[i].charEnd <= seg[i+1].charStart）
  // 3. 验证无间隙（seg[i].charEnd === seg[i+1].charStart）
  // 4. 验证边界（末段 charEnd <= fullText.length）
  // 失败时 console.error 并抛出，开发阶段立即暴露
}
```

仅在开发环境（`process.env.NODE_ENV === 'development'`）执行完整验证，生产环境仅做轻量检查。

## Risks / Trade-offs

- **[R] fullText 格式变化可能影响已上传的测试数据**
  → 数据库仅 2 条测试记录，修复后删除重建即可

- **[R] pagerender 回调依赖 pdf-parse 内部 API（getTextContent），未来版本可能变更**
  → D3 的接口定义使变更点集中在一处；运行时守卫提供清晰的错误信息

- **[R] 均匀页码分配对不均匀段落分布（如首页目录、末页附录）可能偏差**
  → 这是回退方案的固有局限，`console.warn` 已告知调用方；正常 PDF 几乎不会触发回退

## Migration Plan

1. 修改 `lib/parser.ts` 的 `parsePdf` 函数（重构，不影响导出签名）
2. 修改 `app/api/upload/route.ts`（添加 ParseResult import + 类型标注）
3. 运行 `npx tsc --noEmit` 确认零错误
4. 删除数据库中已有的测试文档（`DELETE FROM documents`）
5. 用 curl 重新上传测试 PDF 和 Word，验证 segments 偏移量正确
6. 浏览器手动验证上传流程

无需回滚计划——不涉及数据库迁移或 API 变更。

# Spec: Document Parsing (Delta)

## MODIFIED Requirements

### Requirement: PDF text extraction with position metadata

系统 SHALL 使用 pdf-parse 提取 PDF 文本（单次调用），按页遍历并按自然段落分割，通过渐进构建 fullText 的方式为每个段落计算全局字符偏移量（charStart/charEnd），确保偏移量与 fullText 严格对应。pdf-parse 内部回调使用明确定义的 TypeScript 接口，不依赖 `as` 强制类型断言。

#### Scenario: Parse a multi-page PDF

- **WHEN** 解析一个 3 页的 PDF 文档
- **THEN** 返回的 `fullText` 包含所有页的规范化文本（段落间以 `\n\n` 分隔，页面间以 `\n` 分隔）
- **AND** `segments` 数组中每个元素包含 `page`、`content`、`charStart`、`charEnd` 字段
- **AND** 所有 segments 的 `charStart` 到 `charEnd` 连续覆盖全文，无间隙无重叠
- **AND** 每个 segment 的 `content` 在 `fullText` 中从 `charStart` 到 `charEnd` 位置精确匹配

#### Scenario: Parse a single-page PDF

- **WHEN** 解析一个单页 PDF
- **THEN** `pageCount` 为 1
- **AND** 所有 segments 的 `page` 均为 1
- **AND** charStart 从 0 开始，charEnd 在 fullText.length 范围内

#### Scenario: Pagerender fallback with page distribution

- **WHEN** pagerender 回调无法收集到页面内容（segments 为空）
- **THEN** 系统使用 `data.text` 作为全文、`data.numpages` 作为总页数
- **AND** `console.warn` 输出降级警告信息
- **AND** 每个 segment 的 `page` 基于段落索引和总页数均匀分配（`Math.ceil((i+1) * numpages / segments.length)`），而非全部标记为 1

#### Scenario: Type-safe pagerender internals

- **WHEN** pagerender 回调处理单页文本内容
- **THEN** `PDFTextItem` 和 `PDFPageData` 接口在 parser.ts 内部定义
- **AND** 对 `getTextContent` 方法进行运行时守卫检查（`typeof pageData.getTextContent === 'function'`）
- **AND** `items` 数组通过 `Array.isArray` 验证后访问
- **AND** `transform` 属性通过可选链和类型检查（`typeof item.transform?.[5] === 'number'`）访问

#### Scenario: Parse result validated before return

- **WHEN** PDF 解析完成（pagerender 路径）
- **THEN** 系统对 segments 执行一致性验证（无重叠、无间隙、边界不越界）
- **AND** 开发环境中验证失败抛出明确错误，生产环境中仅记录错误日志

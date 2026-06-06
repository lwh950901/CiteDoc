# Spec: Document Parsing

## ADDED Requirements

### Requirement: PDF text extraction with position metadata

系统 SHALL 使用 pdf-parse 提取 PDF 文本，按页遍历并按自然段落分割，为每个段落计算全局字符偏移量（charStart/charEnd）和页码。

#### Scenario: Parse a multi-page PDF

- **WHEN** 解析一个 3 页的 PDF 文档
- **THEN** 返回的 `fullText` 包含所有页的文本
- **AND** `segments` 数组中每个元素包含 `page`、`content`、`charStart`、`charEnd` 字段
- **AND** 所有 segments 的 `charStart` 到 `charEnd` 连续覆盖全文，无间隙无重叠

#### Scenario: Parse a single-page PDF

- **WHEN** 解析一个单页 PDF
- **THEN** `pageCount` 为 1
- **AND** 所有 segments 的 `page` 均为 1

### Requirement: Word text extraction with position metadata

系统 SHALL 使用 mammoth 提取 Word (.docx) 文本，按段落分割并记录字符偏移量。MVP 阶段将全文视为单页（page=1）。

#### Scenario: Parse a Word document

- **WHEN** 解析一个 .docx 文件
- **THEN** 返回的 `fullText` 包含文档全部文本
- **AND** `segments` 数组中每个元素的 `page` 均为 1
- **AND** 所有 segments 的 charStart 从 0 开始连续覆盖

#### Scenario: Parse an empty Word document

- **WHEN** 解析一个内容为空的 .docx 文件
- **THEN** 返回的 `segments` 数组为空，`fullText` 为空字符串

### Requirement: Parse result type definition

系统 SHALL 导出 `Segment` 和 `ParseResult` 两个 TypeScript 接口，保证类型安全。

#### Scenario: TypeScript compilation

- **WHEN** 其他模块引用 `Segment` 和 `ParseResult` 类型
- **THEN** TypeScript 编译无错误，字段类型完全匹配

### Requirement: Error handling for corrupted documents

系统 SHALL 对解析失败（加密 PDF、损坏文件等）抛出明确错误，由上层 API 捕获并返回友好提示。

#### Scenario: Encrypted PDF

- **WHEN** 尝试解析一个已加密的 PDF
- **THEN** parseDocument 抛出异常，API 返回 500 和提示"文档解析失败，请确认文件未加密或损坏"

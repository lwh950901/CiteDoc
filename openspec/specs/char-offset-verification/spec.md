# Spec: Char Offset Verification

## ADDED Requirements

### Requirement: Parse result self-verification

系统 SHALL 在 PDF 文档解析完成后对 segments 执行一致性验证，确保字符偏移量与 fullText 严格对应。

#### Scenario: Valid segments pass verification

- **WHEN** 解析完成后所有 segments 按 charStart 排序无重叠（`seg[i].charEnd <= seg[i+1].charStart`）、无间隙（`seg[i].charEnd === seg[i+1].charStart`）、且末段 `charEnd <= fullText.length`
- **THEN** 验证通过，parsePdf 正常返回 ParseResult

#### Scenario: Overlapping segments caught

- **WHEN** 解析完成后存在两个相邻 segment，其中 `seg[i].charEnd > seg[i+1].charStart`
- **THEN** 系统在开发环境抛出错误，错误信息包含重叠的 segment 索引和偏移值

#### Scenario: Gap between segments caught

- **WHEN** 解析完成后存在两个相邻 segment，其中 `seg[i].charEnd < seg[i+1].charStart`
- **THEN** 系统在开发环境抛出错误，错误信息包含间隙的位置和大小

#### Scenario: Segment exceeds fullText boundary

- **WHEN** 解析完成后最后一个 segment 的 `charEnd > fullText.length`
- **THEN** 系统在开发环境抛出错误，错误信息包含越界的 segment 和 fullText 长度

#### Scenario: Verification relaxed in production

- **WHEN** 在生产环境（`NODE_ENV !== 'development'`）解析文档
- **THEN** 仅执行末段边界检查（`charEnd <= fullText.length`），不抛出错误，不一致时 `console.error` 记录

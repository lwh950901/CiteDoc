# Spec: Text Splitting with Source Tracing Metadata

## ADDED Requirements

### Requirement: Sliding window text splitting

系统 SHALL 提供 `splitTextWithMeta` 函数，接收 `Segment` 数组和切分配置（`chunkSize`、`overlap`），输出带元数据的 `ChunkWithMeta` 数组。函数 SHALL 保留每个 chunk 在原文中的字符偏移区间（`charStart`/`charEnd`）和起始页码。

#### Scenario: Normal text splitting

- **WHEN** 输入包含 3 个 segments（总文本约 1500 字符），设置 `chunkSize=500, overlap=50`
- **THEN** 输出 4-5 个 chunks，每个 chunk 的 `content` 长度在 400-550 字符之间（最后可能更短）
- **AND** 每个 chunk 的 `charStart`/`charEnd` 区间在原文中精准匹配其 `content`
- **AND** 相邻 chunks 之间存在 overlap 重叠

#### Scenario: Natural breakpoint priority

- **WHEN** chunk 在 `chunkSize` 附近存在自然断点（`\n\n`、`。`、`\n`）
- **THEN** 系统优先在自然断点处截断，而非精确按 `chunkSize` 硬切
- **AND** 断点优先级为：段落分隔（`\n\n`） > 句号（`。`） > 换行（`\n`）

#### Scenario: Page metadata mapping

- **WHEN** 一个 chunk 的内容跨越多个 segment（可能跨页）
- **THEN** 该 chunk 的 `metadata.page` 等于其起始字符位置所在 segment 的页码

#### Scenario: Empty segments input

- **WHEN** 输入的 `segments` 数组为空
- **THEN** 函数返回空数组 `[]`，不抛出异常

#### Scenario: Invalid parameters

- **WHEN** `chunkSize <= 0` 或 `overlap < 0`
- **THEN** 函数抛出 Error，错误信息指明无效的参数名

#### Scenario: Single segment shorter than chunkSize

- **WHEN** 仅有一个 200 字符的 segment，`chunkSize=500`
- **THEN** 输出 1 个 chunk，其 `content` 等于该 segment 的全部内容

### Requirement: Metadata structure completeness

每个 `ChunkWithMeta` 的 `metadata` 字段 SHALL 包含以下所有字段：
- `documentId: string` — 所属文档 UUID
- `page: number` — 起始页码（从 1 开始）
- `charStart: number` — 在原文全文中的起始字符偏移（包含）
- `charEnd: number` — 在原文全文中的结束字符偏移（不包含）

#### Scenario: Metadata fields present

- **WHEN** 切分完成后获取任意一个 chunk
- **THEN** 其 `metadata` 对象包含且仅包含 `documentId`、`page`、`charStart`、`charEnd` 四个字段

### Requirement: Overlap coverage

相邻 chunks 之间 SHALL 存在指定大小的文本重叠，确保语义边界不被切断。

#### Scenario: Chunk content recovers overlap

- **WHEN** `chunkSize=500, overlap=50`
- **THEN** 拼接所有 chunks 按序去重后的 `content`，应覆盖原文全文 100% 的实质内容
- **AND** chunk[i+1] 的前 `overlap` 字符与 chunk[i] 的末尾有文本重叠

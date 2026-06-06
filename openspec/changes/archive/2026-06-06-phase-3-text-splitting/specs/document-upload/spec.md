# Spec: Document Upload (Delta)

## ADDED Requirements

### Requirement: Automatic text splitting after upload

系统 SHALL 在文档解析成功并存入 `documents` 表后，自动调用 `splitTextWithMeta` 对解析结果进行文本切分，并将生成的 chunks 写入 `chunks` 表（`embedding` 字段暂为 NULL）。

#### Scenario: Chunks stored after successful upload

- **WHEN** 文档解析成功且 `segments` 不为空
- **THEN** 系统调用 `splitTextWithMeta(segments, 500, 50)` 生成 chunks
- **AND** 所有 chunks 通过 `INSERT` 写入 `chunks` 表
- **AND** 每条 chunk 的 `metadata` 字段为合法 JSON，包含 `documentId`、`page`、`charStart`、`charEnd`

#### Scenario: Empty document produces no chunks

- **WHEN** 文档解析后 `segments` 为空数组
- **THEN** 系统不执行切分，不向 `chunks` 表插入任何记录
- **AND** 响应中 `chunkCount` 为 0

## MODIFIED Requirements

### Requirement: Upload API accepts PDF and Word files

系统 SHALL 提供一个 POST `/api/upload` 端点，接收 multipart/form-data 格式的文件上传，字段名为 `file`。上传后自动进行文档解析和文本切分。

#### Scenario: Successful PDF upload

- **WHEN** 用户上传一个有效的 PDF 文件
- **THEN** 系统返回 200 状态码，响应体包含 `documentId`、`name`、`pageCount`、`segments` 数组和 `chunkCount`
- **AND** `documents` 表中新增一条记录，`content` 包含完整文档文本
- **AND** `chunks` 表中新增该文档的切分记录，每条包含 `content` 和 `metadata` JSON

#### Scenario: Successful Word upload

- **WHEN** 用户上传一个有效的 .docx 文件
- **THEN** 系统返回 200 状态码，响应体包含 `documentId`、`name`、`pageCount`、`segments`、`chunkCount`
- **AND** Word 文档被成功解析并存入数据库
- **AND** `chunks` 表中新增该文档的切分记录

# Spec: Document Upload

## ADDED Requirements

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

### Requirement: File type validation

系统 SHALL 校验上传文件的 MIME 类型，仅允许 `application/pdf` 和 `application/vnd.openxmlformats-officedocument.wordprocessingml.document`。

#### Scenario: Unsupported file type

- **WHEN** 用户上传一个 .txt 文件
- **THEN** 系统返回 400 状态码，错误消息为"仅支持 PDF 和 Word 文件"

#### Scenario: No file provided

- **WHEN** 请求体中不包含 `file` 字段
- **THEN** 系统返回 400 状态码，错误消息为"请上传文件"

### Requirement: File size limit

系统 SHALL 限制上传文件大小不超过 10MB。

#### Scenario: File exceeds size limit

- **WHEN** 用户上传一个超过 10MB 的文件
- **THEN** 系统返回 413 状态码，错误消息为"文件大小不能超过 10MB"

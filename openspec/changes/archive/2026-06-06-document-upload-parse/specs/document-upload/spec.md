# Spec: Document Upload

## ADDED Requirements

### Requirement: Upload API accepts PDF and Word files

系统 SHALL 提供一个 POST `/api/upload` 端点，接收 multipart/form-data 格式的文件上传，字段名为 `file`。

#### Scenario: Successful PDF upload

- **WHEN** 用户上传一个有效的 PDF 文件
- **THEN** 系统返回 200 状态码，响应体包含 `documentId`、`name`、`pageCount` 和 `segments` 数组
- **AND** `documents` 表中新增一条记录，`content` 包含完整文档文本

#### Scenario: Successful Word upload

- **WHEN** 用户上传一个有效的 .docx 文件
- **THEN** 系统返回 200 状态码，响应体结构与 PDF 上传一致
- **AND** Word 文档被成功解析并存入数据库

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

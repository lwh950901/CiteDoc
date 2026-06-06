# Proposal: Document Upload & Parse

## Why

DocQATracer 的核心交互是"点击答案角标 → 跳转到原文位置并高亮"，这依赖精确的字符级位置元数据。没有文档上传和带位置信息的解析，后续所有溯源功能都无法实现。

## What Changes

- 新增 `POST /api/upload` 路由，接收 PDF/Word 文件，校验类型和大小
- 实现 `lib/parser.ts` 通用解析模块，根据 MIME 类型分发到 PDF 或 Word 解析器
- PDF 解析：使用 pdf-parse 提取每页文本，按段落分割并记录全局字符偏移和页码
- Word 解析：使用 mammoth 提取纯文本，按段落分割记录字符偏移（MVP 阶段视为单页）
- 解析结果（fullText + segments）写入 `documents` 表，segments 随 API 响应返回
- 创建 `FileUpload` 前端组件，覆盖 idle / uploading / success / error 四种状态
- `app/page.tsx` 集成上传组件，上传成功后展示文档 ID 和段落预览

## Capabilities

### New Capabilities
- `document-upload`: 文件上传 API 路由，含类型校验、大小限制（10MB）、错误处理
- `document-parsing`: PDF/Word 文档解析核心逻辑，返回带字符偏移和页码的段落元数据
- `file-upload-ui`: 前端文件上传交互组件，覆盖四种 UI 状态

### Modified Capabilities
<!-- 新增功能，不修改已有 spec -->

## Impact

- `app/api/upload/route.ts`: 新增，文件上传处理
- `lib/parser.ts`: 新增，文档解析核心逻辑 + 类型定义
- `components/FileUpload.tsx`: 新增，前端上传组件
- `app/page.tsx`: 改造，集成 FileUpload 组件
- `db/schema.ts`: 已有，无需修改（使用已创建的 documents 表）

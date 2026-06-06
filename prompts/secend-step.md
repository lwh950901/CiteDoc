# 第二阶段任务：文档上传与解析（保留位置元数据）

## 任务目标
实现 PDF 和 Word 文档的上传接口，在后端完成文本提取，并为每个段落/页面记录在全文中的精确字符偏移量与页码，最后将原始文档存入 `documents` 表，为下一步文本切分和溯源定位做好准备。

---

## 前置条件
- 第一阶段环境已就绪，数据库连接正常，`documents` 表和 `chunks` 表存在
- `pdf-parse` 和 `mammoth` 已安装
- `app/api/upload/route.ts` 文件已存在（可覆盖）

---

## 任务拆解

### 1. 创建文件上传 API 路由
**文件路径**: `app/api/upload/route.ts`

- 使用 Next.js App Router 的 `POST` 方法
- 接收 `multipart/form-data`，字段名为 `file`
- 校验文件类型：仅允许 `application/pdf` 和 `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (docx)
- 文件大小限制：10MB，超出返回 413 错误
- 调用解析函数（见下方），获取 `fullText` 和 `segments` 元数据
- 将原始文档信息（文件名和全文）存入 `documents` 表，返回新建的 `documentId`
- 错误时返回友好的 JSON 错误信息，状态码 400/500

**API 返回格式**:
```json
{
  "documentId": "uuid",
  "name": "example.pdf",
  "pageCount": 10,
  "segments": [
    { "page": 1, "content": "第一段文本...", "charStart": 0, "charEnd": 50 },
    { "page": 1, "content": "第二段文本...", "charStart": 51, "charEnd": 120 }
  ]
}
```

### 2. 实现文档解析核心函数
**文件路径**: `lib/parser.ts`

需要实现一个主解析函数 `parseDocument(fileBuffer: Buffer, mimeType: string)`，根据 MIME 类型分别处理 PDF 和 Word。

#### 2.1 PDF 解析（使用 `pdf-parse`）
- 调用 `pdf-parse(buffer)` 获取文本和各页信息
- 遍历每一页，按自然段落（如两个换行符）或句子（句号、分号）分割
- 维护全局字符计数器，为每个段落计算 `charStart` 和 `charEnd`
- 收集所有 `Segment`（类型：`{ page: number, content: string, charStart: number, charEnd: number }`）
- 同时拼出完整的 `fullText`（各页文本用换行连接）

#### 2.2 Word 解析（使用 `mammoth`）
- `mammoth.extractRawText({ buffer })` 获取纯文本
- 由于 mammoth 不直接提供页码，MVP 阶段可将全文视为单页（`page=1`），但仍需按段落分割并记录字符偏移
- 段落分割规则：按换行符分割，过滤空段落
- 返回同 PDF 结构一致的 `segments` 和 `fullText`

#### 2.3 类型定义
在 `lib/parser.ts` 中导出清晰的接口：
```ts
export interface Segment {
  page: number;
  content: string;
  charStart: number;
  charEnd: number;
}

export interface ParseResult {
  fullText: string;
  segments: Segment[];
  pageCount: number;
}
```

### 3. 数据持久化
- 在 `POST` 处理函数内，得到 `ParseResult` 后，使用 Drizzle 插入 `documents` 表：
  ```ts
  const [doc] = await db.insert(documents).values({
    name: file.name,
    content: fullText,
  }).returning();
  ```
- 当前阶段暂不插入 `chunks`，切分向量化留给第三阶段
- 但路由中需要把 `segments` 随响应返回前端，便于未来切分或展示预览

### 4. 错误处理与边界情况
- 文件未提供（无 file 字段）→ 400，`{ error: "请上传文件" }`
- 文件类型不支持 → 400，`{ error: "仅支持 PDF 和 Word 文件" }`
- 文件大小 > 10MB → 413，`{ error: "文件大小不能超过 10MB" }`
- PDF 解析失败（如加密或损坏）→ 500，记录错误日志，返回 `{ error: "文档解析失败，请确认文件未加密或损坏" }`
- Word 解析失败 → 同上
- 所有错误路径都要 `catch`，并返回结构化 JSON

### 5. 前端集成（最小可用 UI）
**文件路径**: `components/FileUpload.tsx` 和 `app/page.tsx` 改造

- 创建一个 `FileUpload` 组件，包含：
  - 文件选择器（`<input type="file" accept=".pdf,.docx">`）
  - 上传按钮
  - 状态管理：idle / uploading / success / error
  - 拖拽区域（可选，MVP 可先不做）
- 上传成功后，在主页面显示返回的 `documentId` 和段落预览（例如展示前 5 个 segment 的页码和内容摘要）
- 使用 fetch 调用 `/api/upload`，提交 FormData
- 样式使用 Tailwind，保持简洁

### 6. 新增依赖检查
确保 `pdf-parse` 的类型定义可用，若不存在则创建 `types/pdf-parse.d.ts` 声明模块。

### 7. 验证方法
1. 使用 Postman 或 curl 发送 POST 到 `/api/upload`，上传一个测试 PDF
2. 检查响应中的 `segments`，确认每个 segment 的 `charStart` 和 `charEnd` 连续且覆盖全文
3. 查看数据库 `documents` 表，确认记录已插入，`content` 完整
4. 在前端上传界面验证交互和错误提示

---

## 验收检查清单
- [ ] `POST /api/upload` 能成功上传 PDF，返回 200 和正确的 `documentId`、`segments`
- [ ] 对 Word 文件同样能解析并返回正确数据
- [ ] 不支持的文件类型（如 .txt 或 .jpg）返回 400 错误
- [ ] 超过 10MB 的文件返回 413
- [ ] 数据库中 `documents` 表有对应记录，且 `content` 与文件内容一致
- [ ] 前端上传组件可正常交互，loading/error 状态均能体现
- [ ] PDF 的 `segments` 中的 `charStart/charEnd` 拼接后能还原原文无误

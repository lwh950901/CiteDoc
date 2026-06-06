# Tasks: Document Upload & Parse

## 1. Document Parser Core

- [x] 1.1 创建 `lib/parser.ts`，定义 `Segment` 和 `ParseResult` TypeScript 接口
- [x] 1.2 实现 `parsePdf` 函数：pdf-parse 提取文本 + 按自然段落分割 + 计算全局 charStart/charEnd + 页码
- [x] 1.3 实现 `parseWord` 函数：mammoth 提取文本 + 按换行符分段落 + 计算字符偏移（page=1）
- [x] 1.4 实现 `parseDocument` 分发函数：根据 MIME 类型调用 parsePdf 或 parseWord

## 2. Upload API Route

- [x] 2.1 创建 `app/api/upload/route.ts`：解析 multipart/form-data，提取 file 字段
- [x] 2.2 实现文件类型校验（仅允许 PDF 和 .docx）和大小限制（10MB）
- [x] 2.3 调用 `parseDocument` 解析文件，将结果写入 `documents` 表
- [x] 2.4 实现错误处理：400（无文件/格式错误）、413（超限）、500（解析失败）
- [x] 2.5 返回 JSON 响应：{ documentId, name, pageCount, segments }

## 3. Frontend Upload UI

- [x] 3.1 创建 `components/FileUpload.tsx`：文件选择器 + 上传按钮
- [x] 3.2 实现四种状态管理：idle / uploading / success / error，Tailwind 样式
- [x] 3.3 成功状态展示 documentId 和前 5 个 segment 的页码及内容摘要
- [x] 3.4 改造 `app/page.tsx`：集成 FileUpload 组件

## 4. Type Declarations & Verification

- [x] 4.1 创建 `types/pdf-parse.d.ts` 声明模块（@types/pdf-parse 已安装）
- [x] 4.2 TypeScript 编译检查（`npx tsc --noEmit` 零错误）
- [x] 4.3 使用 curl 上传测试 PDF，验证 segments 的 charStart/charEnd 连续覆盖全文
- [x] 4.4 使用 curl 上传测试 Word 文档，验证解析正确
- [ ] 4.5 浏览器验证：上传 + 错误提示 + 成功预览（需在浏览器中手动验证）

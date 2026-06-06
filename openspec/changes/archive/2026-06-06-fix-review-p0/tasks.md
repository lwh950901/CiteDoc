# Tasks: Fix Code Review P0 Issues

## 1. 类型安全基础

- [x] 1.1 在 `lib/parser.ts` 内部定义 `PDFTextItem` 接口（`str: string; transform?: number[]`）
- [x] 1.2 在 `lib/parser.ts` 内部定义 `PDFPageData` 接口（`getTextContent: () => Promise<{ items: PDFTextItem[] }>`）
- [x] 1.3 在 `app/api/upload/route.ts` 中为 `parseResult` 显式标注 `ParseResult` 类型（import from @/lib/parser）

## 2. parsePdf 核心重构

- [x] 2.1 合并 pagerender：第一次无回调解析获取可靠数据，第二次 pagerender 最佳努力获取每页文本
- [x] 2.2 重写 pagerender 回调：使用 `PDFPageData` 接口 + 运行时守卫（`typeof getTextContent === 'function'`、`Array.isArray(items)`、`typeof transform?.[5] === 'number'`）
- [x] 2.3 实现渐进构建 fullText：段落间用 `\n\n` 连接，页面间用 `\n` 连接，同时计算 charStart/charEnd
- [x] 2.4 改进回退方案：使用 `data.numpages` 做均匀页码分配（`Math.ceil((i+1) * numpages / segments.length)`），添加 `console.warn` 降级提示

## 3. 解析结果自验证

- [x] 3.1 实现 `validateSegments(segments, fullText)` 函数：按 charStart 排序后检查重叠、间隙、越界
- [x] 3.2 开发环境（`NODE_ENV === 'development'`）执行完整验证，失败抛出明确错误
- [x] 3.3 生产环境仅执行末段边界检查，不一致时 `console.error` 记录
- [x] 3.4 在 `parsePdf` 返回前调用 `validateSegments`

## 4. 编译与测试验证

- [x] 4.1 运行 `npx tsc --noEmit` 确认零 TypeScript 错误
- [x] 4.2 使用 curl 上传测试 PDF，验证每个 segment 的 `content` 在 `fullText[charStart..charEnd]` 精确匹配
- [x] 4.3 使用 curl 上传测试 Word 文档，确认 parseWord 不受影响（回归测试）
- [x] 4.4 浏览器验证：页面加载 ✅ / 错误提示 ✅ / AI 连接 ✅ / 文件上传需手动选择（浏览器安全限制）

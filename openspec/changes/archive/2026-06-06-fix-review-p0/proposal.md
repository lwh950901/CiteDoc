# Proposal: Fix Code Review P0 Issues

## Why

Phase 1-2 code review 发现 `lib/parser.ts` 中 PDF 段落字符偏移量（charStart/charEnd）存在**系统性计算错误**——段落间分隔符长度被错误假定为单字符，导致每个段落偏移误差 +1，随文档增长累计。此 bug 破坏溯源定位的数学基础：后续 chunking → embedding → RAG 检索 → 前端高亮跳转的完整链路中，所有位置映射都是错的。必须在 Phase 3（文本分块 + 向量化）开始前修复，否则全部下游数据均为无效。

同时，pagerender 回退方案在已有 `data.numpages`（总页数）的情况下，将所有段落页码标记为 1，且不做任何警告，属于静默数据降级。

## What Changes

### 必须修复（P0 / Critical）

- **修复 PDF 段落偏移量算法**：弃用手动计算 `globalOffset = end + 1`，改为在 `fullText` 中通过 `indexOf` 动态查找各段落实际位置，确保 `charStart`/`charEnd` 与 `fullText` 严格对应，满足 spec "所有 segments 的 charStart 到 charEnd 连续覆盖全文，无间隙无重叠"

- **消除 PDF 双解析**：将 `pagerender` 回调合并到首次 `pdfParse` 调用中，删除第二次冗余调用，文档仅解析一次

- **强化类型安全**：替换 pagerender 回调中的三层 `as` 不安全断言为明确接口定义 + 运行时守卫；修复 `upload/route.ts` 中 `let parseResult` 隐式 `any` 类型

- **回退方案改进**：pagerender 失败时利用已知 `data.numpages` 做段落页码均匀分配，并 `console.warn` 提示降级

### 分析：每个问题必须修复的原因

**C-1 (PDF 偏移量 bug) — 溯源核心数学基础**

段落偏移量是全文检索后反向定位原文位置的唯一桥梁。RAG 流程为：用户提问 → embedding 检索相似 chunk → chunk 携带 charStart/charEnd → 前端在 fullText 中高亮对应区间。如果 charStart/charEnd 与 fullText 实际位置不一致，高亮区域将偏移到错误文字上——用户看到的"AI 答案来源"指向的是错误的段落。多段落文档中这个偏移会逐段累积，3 页文档就可能偏 10+ 个字符。此 bug 不修复，整个溯源功能是假功能。

**C-2 (回退方案丢页码) — 静默降级风险**

`pagerender` 回调依赖 PDF 内部字体资源，某些 PDF（如纯图片 PDF、非标准生成器产物）可能触发回退。当前回退方案将所有段落标记为 `page: 1`，用户无法感知数据已降级。对于多页文档（如 20 页报告），溯源显示"第 1 页"实际上可能是第 15 页的内容。至少需要：a) 警告日志；b) 利用 `data.numpages` 做近似页码分配。

**H-1 (PDF 双解析) — 性能浪费**

`pdfParse` 每次调用完整解压 + 解析 PDF 二进制流。10MB 上限的文档被解析两次，CPU 和内存翻倍。在 serverless 环境中直接影响冷启动时间和计费。

**H-2 (不安全类型断言) — 运行时健壮性**

三层 `as` 断言绕过了 TypeScript 的全部类型检查。pdf-parse 是社区维护库，内部 API 可能随版本变化。当前代码在遇到不同版本时不会给出编译错误，而是运行时崩溃或静默返回错误数据。

**H-3 (隐式 any) — 类型安全规范**

role.md 明确要求 strict 模式、禁止 `any`。`let parseResult` 无类型标注在 strict 模式下本应报错（因 `noImplicitAny` 隐含开启），但由于变量在 try 块内赋值、外层使用，TS 无法推断而退化为隐式 `any`。必须显式标注 `ParseResult` 类型。

## Capabilities

### New Capabilities

- `char-offset-verification`: 解析结果自验证——解析完成后对 segments 执行一致性断言（按 charStart 排序后无重叠、无间隙、末段 charEnd ≤ fullText.length），在开发阶段尽早捕获偏移量错误

### Modified Capabilities

- `document-parsing`: PDF 段落偏移量计算方式变更——从手动累加偏移改为基于 fullText 索引查找；pagerender 回退方案的页码行为从不区分改为基于 numpages 的近似分配；新增解析后自验证步骤

## Impact

- **受影响的代码**：`lib/parser.ts`（核心修改，parsePdf 函数重构）、`app/api/upload/route.ts`（parseResult 类型标注）
- **API 不变**：`ParseResult` 接口字段不变，API 响应 shape 不变，前端无需改动
- **依赖**：无新增依赖，不修改 `package.json`
- **数据**：不修改数据库 schema，但已有的 2 条测试数据（之前上传的文档）其 segment 偏移量是错误的，修复后重新上传即可
- **风险**：低。修改仅影响 `parsePdf` 内部实现，parseWord 已使用正确的 indexOf 方案作为参考实现

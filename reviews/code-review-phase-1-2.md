# Code Review: Phase 1-2（环境搭建 + 文档上传解析）

> **审查日期**: 2026-06-06 | **修复 Change**: [fix-review-p0](../openspec/changes/fix-review-p0/)
> **审查范围**: 7 个源文件（文档解析、上传 API、前端 UI、数据库层）
> **审查标准**: role.md（TypeScript strict、禁止 any、完整错误处理、模块化）

---

## 总览

| 严重度 | 数量 | 状态 |
|--------|------|------|
| 🔴 Critical | 2 | ✅ 全部修复 |
| 🟡 High | 3 | ✅ 全部修复 |
| 🟢 Medium | 4 | ⬜ 待处理 |
| ⚪ Low | 2 | ⬜ 待处理 |

---

## 综合评分

| 维度 | 修复前 | 修复后 |
|------|--------|--------|
| 类型安全 | ⚠️ 7 | ✅ 9 |
| 错误处理 | ✅ 8 | ✅ 9 |
| 核心算法 | 🔴 5 | ✅ 9 |
| 代码组织 | ✅ 9 | ✅ 9 |
| 前端状态管理 | ✅ 9 | ✅ 9 |
| 架构前瞻性 | ⚠️ 7 | ⚠️ 8 |

---

## ✅ 已修复（5 项）

| 编号 | 问题 | 根因 | 修复方式 |
|------|------|------|----------|
| **C-1** | PDF charStart/charEnd 偏移量系统性错误 | `globalOffset = end + 1` 未计入 `\n\n` 等多字符分隔符 | **渐进构建 fullText**：段落追加时同步记录偏移量，由构造保证正确 |
| **C-2** | 回退方案将所有段落页码标为 1 | 未利用已知 `data.numpages` | 均匀分配 `Math.ceil((i+1) * numpages / total)` + `console.warn` |
| **H-1** | PDF 被解析两次 | 首次获取元数据 + 二次仅为 pagerender 副作用 | 首次无回调解析获取可靠数据，二次 pagerender 最佳努力（独立 try-catch） |
| **H-2** | 三层 `as` 不安全类型断言 | pagerender 回调直接强转 pdf-parse 内部类型 | 定义 `PDFTextItem`/`PDFPageData` 接口 + `typeof`/`Array.isArray` 运行时守卫 |
| **H-3** | `let parseResult` 隐式 `any` | try-catch 内赋值导致 TS 类型推断退化为 any | 显式标注 `let parseResult: ParseResult` |

**额外修复**:
- `pdf-parse` 不接受 Node.js `Buffer`，需 `new Uint8Array(fileBuffer)` 转换
- 新增 `validateSegments()` 自验证机制（开发环境完整校验，生产环境轻量检查）

---

## ⬜ 待处理（6 项）

### M-1. 调试代码残留
- **文件**: `app/page.tsx:18-20`
- **问题**: `useEffect(() => console.log("Messages:", messages), [messages])` — 生产环境泄露对话内容
- **修复**: 移除或加 `NODE_ENV === 'development'` 条件

### M-2. 数据库连接池无错误处理
- **文件**: `lib/db.ts:9-11`
- **问题**: 模块加载时立即创建 Pool，数据库不可达时启动崩溃且无友好提示
- **修复**: 添加启动时健康检查或延迟初始化

### M-3. embedding 列未设 NOT NULL
- **文件**: `db/schema.ts:34`
- **问题**: 无向量的 chunks 在检索时静默跳过
- **修复**: `.notNull()` 或应用层校验（Phase 3 开始前处理）

### M-4. 解析成功但 DB 写入失败时数据丢失
- **文件**: `app/api/upload/route.ts:70-77`
- **问题**: 解析（耗时）→ DB 写入（可能失败），解析结果无法重试
- **修复**: 后续考虑异步两步流程

### L-1. parseWord 中 `indexOf` 理论错误匹配
- **文件**: `lib/parser.ts:150`
- **问题**: 极低概率下重复段落文本匹配到错误位置
- **修复**: 使用更精确的偏移追踪替代 indexOf 查找

### L-2. 前端 fetch 缺少超时
- **文件**: `components/FileUpload.tsx:36-39`
- **问题**: 大文件上传超时时用户永远看到"上传中..."
- **修复**: 添加 `AbortController` 30s 超时

---

## 架构建议

1. ~~**charStart/charEnd 需自验证**~~ ✅ 已实现 `validateSegments()`
2. **Segments 应持久化**: 当前仅返回前端，不存库。Phase 3 chunking 需新增 `segments` 表或 JSONB 列
3. **Chat API 与 DB 解耦**: chat route 声明 `runtime = "edge"`，但 pg Pool 是 Node.js 运行时。Phase 4 需改为 Node runtime 或拆分 DB 查询到独立 route

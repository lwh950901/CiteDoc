# 第三阶段任务：文本智能切分（保留溯源元数据）

## 任务目标
将第二阶段解析得到的文档全文及其位置元数据（`segments`），切分成适合向量检索的文本块（chunks）。切分过程必须保留每个 chunk 对应的原文字符偏移区间和页码，确保后续溯源定位不丢失精度。

---

## 前置条件
- 第二阶段 `lib/parser.ts` 已实现，导出了 `ParseResult` 和 `Segment` 类型
- `documents` 表中已有至少一条测试文档记录（含完整 `content`）
- `chunks` 表已在第一阶段建好，字段包含 `documentId`, `content`, `embedding`, `metadata`

---

## 核心设计决策（面试可讲）
- **不使用 LangChain 的 RecursiveCharacterTextSplitter**：因为它不保留字符偏移量，切完后无法溯源回原文位置
- **采用滑动窗口 + 元数据挂载**：每个 chunk 携带 `{ page, charStart, charEnd }`，前端可直接用 `charStart/charEnd` 在原文 DOM 中定位高亮
- **分段符优先级**：段落 > 句子 > 词（中文按标点，英文按空格），避免切断语义单元

---

## 任务拆解

### 1. 创建文本切分模块
**文件路径**: `lib/splitter.ts`

需要实现核心函数 `splitTextWithMeta`，输入第二阶段解析得到的 `segments`，输出带元数据的 chunk 数组。

#### 1.1 函数签名
```ts
export interface ChunkWithMeta {
  content: string;
  metadata: {
    documentId: string;
    page: number;
    charStart: number;
    charEnd: number;
  };
}

export function splitTextWithMeta(
  segments: Segment[],       // 来自 parser.ts
  chunkSize: number,         // 推荐 500 字符
  overlap: number            // 推荐 50 字符
): ChunkWithMeta[];
```

#### 1.2 切分逻辑
1. 将 `segments` 按照 `charStart` 排序（确保顺序正确）
2. 把所有 segment 的文本拼接成一个完整的长文本（用空格连接各段落），同时维护一个 **字符索引 → 段落元数据（页码）的映射表**
3. 在长文本上使用滑动窗口：
   - 窗口从 `charStart=0` 开始，向右滑动
   - 每次取窗口内的文本，尝试在 `chunkSize` 附近找一个**自然断点**（优先在 `\n\n`、`\n`、`。`、`；`、`.` 处截断）
   - 取不到自然断点时，就在 `chunkSize` 精确处切断，但要记录“此处为硬截断”
4. 每切出一个 chunk，根据它的起始和结束字符位置，反查该区间内**首次出现的 segment 对应的页码**作为该 chunk 的页码（因为一个 chunk 可能跨页，MVP 阶段取起始页即可）
5. 窗口向前移动 `chunkSize - overlap` 的距离，继续切割
6. 最后一个 chunk 即使不足 `chunkSize` 也保留

#### 1.3 元数据构建
每个 `ChunkWithMeta` 的 `metadata` 必须包含：
- `documentId`: 从参数传入（切分时调用方传入）
- `page`: 该 chunk 起始内容所在的页码
- `charStart`: 该 chunk 在原文全文 `documents.content` 中的起始字符偏移
- `charEnd`: 该 chunk 在原文全文中的结束字符偏移

#### 1.4 边界处理
- 原文为空 → 返回空数组 `[]`
- `chunkSize <= 0` 或 `overlap < 0` → 抛出错误
- `segments` 中存在 `charStart/charEnd` 不连续或重叠 → 在控制台 warn，但不中断（按 charStart 排序后强行拼接）
- 单个 segment 内容极长（超过 chunkSize 2 倍）→ 强制按 chunkSize 硬切，标记“硬截断”元数据（可选，MVP 可忽略）

### 2. 修改上传路由，集成切分逻辑
**文件路径**: `app/api/upload/route.ts`

在第二阶段的上传路由中，文档解析并存入 `documents` 表后，增加以下步骤：

1. 调用 `splitTextWithMeta(segments, 500, 50)` 获得 `chunks` 数组
2. 将 `chunks` 数组存入 `chunks` 表（**暂不生成 embedding**，`embedding` 字段先填 NULL，留给第四阶段批量处理）
3. 插入逻辑：
```ts
for (const chunk of chunks) {
  await db.insert(chunks).values({
    documentId: chunk.metadata.documentId,
    content: chunk.content,
    metadata: JSON.stringify(chunk.metadata),
    // embedding 暂时为 null
  });
}
```
4. 返回给前端的响应中，增加 `chunkCount` 字段，便于调试

### 3. 添加测试辅助接口（可选但推荐）
**文件路径**: `app/api/documents/[id]/chunks/route.ts`

- `GET` 请求，根据 `documentId` 查询 `chunks` 表
- 返回该文档所有 chunk，但不返回 `embedding` 字段（太大），仅返回 `id`、`content`（截断前100字符）、`metadata`
- 这个接口纯粹用于验证切分效果，后续阶段可删除

### 4. 单元测试 / 验证脚本
**文件路径**: `lib/__tests__/splitter.test.ts`（如果项目已配置测试）或提供一段可手动运行的验证代码

验证要点：
1. 用一组模拟的 `segments` 输入，检查输出 chunk 的数量是否合理
2. 拼接所有 chunk 的 `content`（按顺序），应覆盖原文 90% 以上内容（因为有 overlap 重复，所以不是 100%）
3. 每个 chunk 的 `charEnd - charStart` 接近 `chunkSize`（最后一个除外）
4. 随机抽查一个 chunk，其 `content` 能在原 `fullText` 的 `charStart~charEnd` 位置精准匹配

### 5. 更新类型导出
在 `lib/index.ts`（如不存在则创建）中统一导出 `Splitter` 相关类型，方便后续模块引用。

---

## 验收检查清单
- [ ] `splitTextWithMeta` 函数存在且签名正确
- [ ] 用一段 2000 字符的测试文本，设置 `chunkSize=500, overlap=50`，输出 4-5 个 chunk
- [ ] 每个 chunk 的 `charStart/charEnd` 区间在原文中精准匹配对应文本
- [ ] 每个 chunk 的 `metadata.page` 能正确反映起始段落所在的页码
- [ ] 上传一个新文档后，数据库 `chunks` 表有对应记录，且 `metadata` 字段包含合法的 JSON
- [ ] `GET /api/documents/:id/chunks` 能返回 chunk 列表（不含 embedding）
- [ ] 空文档上传后不报错，`chunks` 表无对应记录
- [ ] 超长段落（如 2000 字符无换行）不会导致死循环或崩溃

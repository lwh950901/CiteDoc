import type { Segment } from "./parser";

// ---- 类型定义 ----

/** 切分后的文本块，携带溯源所需的位置元数据 */
export interface ChunkWithMeta {
  content: string;
  metadata: ChunkMetadata;
}

/** Chunk 溯源元数据 */
export interface ChunkMetadata {
  /** 所属文档 UUID */
  documentId: string;
  /** 起始页码（从 1 开始），chunk 跨页时取起始段落所在页 */
  page: number;
  /** 在原文全文中的起始字符偏移（包含） */
  charStart: number;
  /** 在原文全文中的结束字符偏移（不包含） */
  charEnd: number;
}

// ---- 内部类型 ----

/** 偏移量到页码的映射条目 */
interface PageMapEntry {
  /** fullText 中的起始位置（对应 page 的第一段） */
  offset: number;
  page: number;
}

// ---- 自然断点 ----

/**
 * 自然断点字符，按优先级排列
 * 优先级：段落分隔 > 中文句尾 > 换行 > 英文句尾 > 中文分号 > 其他
 */
const NATURAL_BREAKS: Array<{ pattern: string; priority: number }> = [
  { pattern: "\n\n", priority: 1 },
  { pattern: "。", priority: 2 },
  { pattern: "；", priority: 2 },
  { pattern: "！", priority: 2 },
  { pattern: "？", priority: 2 },
  { pattern: "\n", priority: 3 },
  { pattern: ". ", priority: 4 },
  { pattern: "; ", priority: 4 },
  { pattern: "? ", priority: 4 },
  { pattern: "! ", priority: 4 },
  { pattern: " ", priority: 5 },
  { pattern: "，", priority: 6 },
  { pattern: ",", priority: 6 },
];

/**
 * 在 target 位置附近搜索最佳自然断点
 * 搜索范围：[target - lookBehind, target + lookAhead]
 * 返回找到的断点位置（断点前的内容结束位置），未找到则返回 target
 */
function findNaturalBreak(
  text: string,
  target: number,
  lookBehind: number,
  lookAhead: number
): number {
  const searchStart = Math.max(0, target - lookBehind);
  const searchEnd = Math.min(text.length, target + lookAhead);

  // 按优先级尝试每个断点模式
  for (let priority = 1; priority <= 6; priority++) {
    const patterns = NATURAL_BREAKS.filter((b) => b.priority === priority);
    let bestPos = -1;

    for (const { pattern } of patterns) {
      // 在搜索范围内查找所有匹配
      let pos = text.indexOf(pattern, searchStart);
      while (pos !== -1 && pos < searchEnd) {
        // 断点位置 = 匹配位置 + pattern 长度（跳过断点字符本身）
        const breakPos = pos + pattern.length;
        if (breakPos > bestPos) {
          bestPos = breakPos;
        }
        pos = text.indexOf(pattern, pos + 1);
      }
    }

    // 如果一个优先级有匹配，选择最接近 target 的
    if (bestPos !== -1) {
      return bestPos;
    }
  }

  // 无自然断点：硬切
  return target;
}

// ---- 核心切分 ----

/**
 * 对文档段落进行滑动窗口文本切分，保留每个 chunk 的字符偏移和页码元数据
 *
 * 设计决策（详见 design.md）：
 * - 渐进构建 fullText，偏移量由构造保证正确
 * - 自然断点优先切分（\n\n > 。 > \n > . > 空格 > ，）
 * - 页码映射：chunk 起始位置所在段落的页号为 chunk 页码
 * - 超长段落强制硬切，避免死循环
 *
 * @param segments - 来自 parser.ts 的段落元数据数组
 * @param chunkSize - 目标 chunk 大小（字符数），推荐 500
 * @param overlap   - 相邻 chunk 重叠字符数，推荐 50
 * @param documentId - 所属文档 UUID
 * @returns ChunkWithMeta 数组
 */
export function splitTextWithMeta(
  segments: Segment[],
  chunkSize: number,
  overlap: number,
  documentId: string
): ChunkWithMeta[] {
  // ---- 边界校验 ----
  if (segments.length === 0) {
    return [];
  }

  if (chunkSize <= 0) {
    throw new Error(`chunkSize must be > 0, got ${chunkSize}`);
  }

  if (overlap < 0) {
    throw new Error(`overlap must be >= 0, got ${overlap}`);
  }

  // ---- 按 charStart 排序（防御性）----
  const sorted = [...segments].sort((a, b) => a.charStart - b.charStart);

  // ---- 渐进构建 fullText + pageMap ----
  let fullText = "";
  const pageMap: PageMapEntry[] = [];

  for (const seg of sorted) {
    const currentOffset = fullText.length;
    pageMap.push({ offset: currentOffset, page: seg.page });
    fullText += seg.content;
    // segment 之间用空格连接，保持搜索自然断点有效
    fullText += " ";
  }

  // ---- 按 charStart 快速查找页码 ----
  function lookupPage(charPosition: number): number {
    let page = 1;
    for (const entry of pageMap) {
      if (entry.offset <= charPosition) {
        page = entry.page;
      } else {
        break;
      }
    }
    return page;
  }

  // ---- 滑动窗口切分 ----
  const chunks: ChunkWithMeta[] = [];
  let cursor = 0;

  while (cursor < fullText.length) {
    // 剩余文本不足 chunkSize 时直接取全部
    if (cursor + chunkSize >= fullText.length) {
      const content = fullText.slice(cursor).trim();
      if (content.length > 0) {
        chunks.push({
          content,
          metadata: {
            documentId,
            page: lookupPage(cursor),
            charStart: cursor,
            charEnd: fullText.length,
          },
        });
      }
      break;
    }

    // 目标切分点：cursor + chunkSize
    const targetPos = cursor + chunkSize;

    // 检查当前片段是否为超长段落（无自然断点的长文本）
    // 在 chunkSize ± 20% 范围内搜索自然断点
    const lookBehind = Math.floor(chunkSize * 0.2);
    const lookAhead = Math.floor(chunkSize * 0.2);

    let breakPos = findNaturalBreak(fullText, targetPos, lookBehind, lookAhead);

    // 如果自然断点退回到很近的位置（< 50% chunkSize），说明这片文本缺乏断点，强制硬切
    if (breakPos - cursor < chunkSize * 0.5) {
      console.warn(
        `[splitter] Hard break at ${targetPos}: no natural break found within ${lookBehind}-${lookAhead} chars of ${targetPos}`
      );
      breakPos = targetPos;
    }

    const content = fullText.slice(cursor, breakPos).trim();
    if (content.length > 0) {
      chunks.push({
        content,
        metadata: {
          documentId,
          page: lookupPage(cursor),
          charStart: cursor,
          charEnd: breakPos,
        },
      });
    }

    // 窗口向前滑动：chunkSize - overlap
    cursor = breakPos - overlap;
    if (cursor < 0) cursor = 0;

    // 防止死循环：确保每次至少前进 1 个字符（极端情况：整个 segment 无一字符时）
    // 此处由 overlap < chunkSize 保证（边界校验时已确认 overlap >= 0 且 chunkSize > 0）
    if (overlap >= chunkSize) {
      cursor = breakPos;
    }
  }

  return chunks;
}

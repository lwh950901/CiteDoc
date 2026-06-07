import type { Buffer } from "node:buffer";
import pdfParse from "pdf-parse";

// ---- 类型定义 ----

/** 文档段落元数据，保留溯源定位所需的位置信息 */
export interface Segment {
  /** 页码（从 1 开始），Word 文档 MVP 阶段统一为 1 */
  page: number;
  /** 段落在全文中的起始字符偏移（包含） */
  charStart: number;
  /** 段落在全文中的结束字符偏移（不包含） */
  charEnd: number;
  /** 段落文本内容 */
  content: string;
}

/** 文档解析结果 */
export interface ParseResult {
  /** 完整文档纯文本 */
  fullText: string;
  /** 段落元数据数组 */
  segments: Segment[];
  /** 总页数 */
  pageCount: number;
}

// ---- pdf-parse 内部类型（pagerender 回调用）----

/** PDF 文本项，对应 pdf-parse 内部 items 数组元素 */
interface PDFTextItem {
  str: string;
  transform?: number[];
}

/** PDF 页面数据，对应 pagerender 回调参数 */
interface PDFPageData {
  getTextContent: () => Promise<{ items: PDFTextItem[] }>;
}

// ---- 内部工具 ----

/**
 * 按自然段落分割文本，返回分段的行数组
 * 段落分隔：两个及以上连续换行（含空格行）
 */
function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

// ---- PDF 解析 ----

/**
 * 解析 PDF 文档，提取文本并按段落分割，计算全局字符偏移量
 *
 * 核心改进（fix-review-p0）：
 * - 渐进构建 fullText，偏移量由构造保证正确（不再手动累加 globalOffset）
 * - 第一次无回调解析获取可靠全文 + 页数；第二次 pagerender 尝试获取每页文本
 * - pagerender 使用明确定义的接口 + 运行时守卫；失败时走回退方案
 * - 回退方案基于 numpages 做均匀页码分配，并 console.warn 提示降级
 */
async function parsePdf(fileBuffer: Buffer): Promise<ParseResult> {
  // ---- 1. 无回调解析：获取可靠的全文和页数（适用于所有 PDF）----
  const data = await pdfParse(fileBuffer);

  // ---- 2. 尝试带 pagerender 的二次解析以获取每页文本（最佳努力）----
  // pagerender 对部分 PDF（如 pdf-lib 生成的非标准格式）会触发内部引擎崩溃
  // 因此作为独立 try-catch，失败时不影响已有 data
  const pageContents: string[] = [];

  try {
    await pdfParse(fileBuffer, {
      pagerender: function (pageData: unknown) {
        const pd = pageData as PDFPageData;
        if (typeof pd.getTextContent !== "function") {
          return "";
        }

        return pd.getTextContent().then(function (textContent) {
          const items = textContent?.items;
          if (!Array.isArray(items)) {
            return "";
          }

          let lastY: number | undefined;
          let text = "";

          for (const item of items) {
            const str = item?.str;
            if (typeof str !== "string") continue;

            const transform = item?.transform;
            const itemY =
              Array.isArray(transform) && transform.length > 5
                ? transform[5]
                : undefined;

            if (lastY !== undefined && itemY !== undefined && Math.abs(itemY - lastY) > 2) {
              text += "\n";
            } else if (lastY !== undefined && itemY !== undefined) {
              text += " ";
            }
            text += str;
            lastY = itemY;
          }

          pageContents.push(text);
          return "";
        });
      },
    });
  } catch (e) {
    // pagerender 失败，pageContents 保持为空，后续走回退方案
    console.warn("pdf-parse pagerender failed, using fallback:", (e as Error).message);
  }

  // ---- 渐进构建 fullText + segments（偏移量由构造保证正确）----
  const segments: Segment[] = [];
  let fullText = "";

  if (pageContents.length > 0) {
    for (let i = 0; i < pageContents.length; i++) {
      const paragraphs = splitIntoParagraphs(pageContents[i]);
      if (paragraphs.length === 0) continue;

      for (let j = 0; j < paragraphs.length; j++) {
        const para = paragraphs[j];
        const charStart = fullText.length;
        fullText += para;
        const charEnd = fullText.length;

        segments.push({
          page: i + 1,
          charStart,
          charEnd,
          content: para,
        });

        // 段落间用 \n\n 分隔，页面间用 \n 分隔
        const isLastParagraphOnPage = j === paragraphs.length - 1;
        const isLastPage = i === pageContents.length - 1;

        if (!isLastParagraphOnPage) {
          fullText += "\n\n"; // 段间分隔
        } else if (!isLastPage) {
          fullText += "\n"; // 页间分隔
        }
      }
    }
  }

  // ---- 回退方案：pagerender 无法提取页面内容时使用 data.text ----
  if (segments.length === 0) {
    console.warn(
      "pdf-parse pagerender fallback: 使用默认文本提取 + 均匀页码分配。" +
      "部分 PDF（如纯图片或非标准生成器产物）可能触发此降级。"
    );

    // data 来自第一次无回调解析，data.text 包含可靠全文
    const paragraphs = splitIntoParagraphs(data.text);
    const numpages = data.numpages || 1;

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];
      const charStart = fullText.length;
      fullText += para;
      const charEnd = fullText.length;

      // 基于 numpages 均匀分配段落页码
      const estimatedPage = Math.ceil((i + 1) * numpages / paragraphs.length);

      segments.push({
        page: estimatedPage,
        charStart,
        charEnd,
        content: para,
      });

      // 段落间分隔
      if (i < paragraphs.length - 1) {
        fullText += "\n\n";
      }
    }
  }

  // ---- 解析结果自验证 ----
  validateSegments(segments, fullText);

  return {
    fullText,
    segments,
    pageCount: data.numpages,
  };
}

// ---- Word 解析 ----

async function parseWord(fileBuffer: Buffer): Promise<ParseResult> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: fileBuffer });

  const fullText = result.value;
  const paragraphs = fullText
    .split(/\n/)
    .map((p: string) => p.trim())
    .filter((p: string) => p.length > 0);

  const segments: Segment[] = [];
  let globalOffset = 0;

  for (const para of paragraphs) {
    const start = globalOffset;
    // 在 fullText 中定位该段落的实际位置
    const actualStart = fullText.indexOf(para, globalOffset);
    if (actualStart === -1) continue;

    const end = actualStart + para.length;
    segments.push({
      page: 1, // MVP: Word 视为单页
      charStart: actualStart,
      charEnd: end,
      content: para,
    });
    globalOffset = end + 1;
  }

  return {
    fullText,
    segments,
    pageCount: 1,
  };
}

// ---- 解析结果自验证 ----

/**
 * 验证 segments 的字符偏移量与 fullText 的一致性
 *
 * - 开发环境：完整验证（重叠、间隙、越界），失败抛出错误
 * - 生产环境：仅末段边界检查，不一致时 console.error 记录
 */
function validateSegments(segments: Segment[], fullText: string): void {
  if (segments.length === 0) return;

  // 按 charStart 排序（segments 应已有序，但做防御性排序）
  const sorted = [...segments].sort((a, b) => a.charStart - b.charStart);

  const isDev = process.env.NODE_ENV === "development";

  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i];

    // 检查单个 segment 的 content 是否与 fullText 对应位置匹配
    const textSlice = fullText.slice(seg.charStart, seg.charEnd);
    if (textSlice !== seg.content) {
      const msg =
        `[validateSegments] Segment ${i} (page ${seg.page}) content mismatch: ` +
        `expected "${seg.content.slice(0, 50)}..." at [${seg.charStart}, ${seg.charEnd}], ` +
        `found "${textSlice.slice(0, 50)}..."`;
      if (isDev) throw new Error(msg);
      else console.error(msg);
    }

    // 检查相邻 segment 之间无重叠（间隙为段落分隔符，属正常）
    if (i < sorted.length - 1) {
      const next = sorted[i + 1];
      if (seg.charEnd > next.charStart) {
        const msg =
          `[validateSegments] Overlap detected: segment ${i} ends at ${seg.charEnd} ` +
          `but segment ${i + 1} starts at ${next.charStart}`;
        if (isDev) throw new Error(msg);
        else console.error(msg);
      }
    }
  }

  // 检查最后一个 segment 不超出 fullText 边界
  const last = sorted[sorted.length - 1];
  if (last.charEnd > fullText.length) {
    const msg =
      `[validateSegments] Last segment ends at ${last.charEnd} but fullText length is ${fullText.length}`;
    if (isDev) throw new Error(msg);
    else console.error(msg);
  }
}

// ---- 统一入口 ----

/**
 * 解析文档，根据 MIME 类型自动分发到 PDF 或 Word 解析器
 * @param fileBuffer - 文件二进制数据
 * @param mimeType - 文件 MIME 类型
 * @returns ParseResult 包含全文、段落元数据和页码
 * @throws 不支持的 MIME 类型或解析失败
 */
export async function parseDocument(
  fileBuffer: Buffer,
  mimeType: string
): Promise<ParseResult> {
  if (mimeType === "application/pdf") {
    return parsePdf(fileBuffer);
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return parseWord(fileBuffer);
  }

  throw new Error("Unsupported file type");
}

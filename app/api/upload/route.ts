import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, chunks } from "@/db/schema";
import { parseDocument } from "@/lib/parser";
import type { ParseResult } from "@/lib/parser";
import { splitTextWithMeta } from "@/lib/splitter";
import { embedChunks } from "@/lib/embeddings";

// 允许的文件 MIME 类型
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

// 文件大小限制：10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    // ---- 1. 解析 multipart/form-data ----
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "请上传文件" },
        { status: 400 }
      );
    }

    const file = formData.get("file");

    // ---- 2. 校验：无文件 ----
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "请上传文件" },
        { status: 400 }
      );
    }

    // ---- 3. 校验：文件类型 ----
    if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
      return NextResponse.json(
        { error: "仅支持 PDF 和 Word (.docx) 文件" },
        { status: 400 }
      );
    }

    // ---- 4. 校验：文件大小 ----
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "文件大小不能超过 10MB" },
        { status: 413 }
      );
    }

    // ---- 5. 解析文档 ----
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    let parseResult: ParseResult;
    try {
      parseResult = await parseDocument(fileBuffer, file.type);
    } catch (parseError) {
      console.error("Document parse error:", parseError);
      return NextResponse.json(
        { error: "文档解析失败，请确认文件未加密或损坏" },
        { status: 500 }
      );
    }

    const { fullText, segments, pageCount } = parseResult;

    // ---- 6. 存入 documents 表 ----
    const [doc] = await db
      .insert(documents)
      .values({
        name: file.name,
        content: fullText,
      })
      .returning();

    // ---- 7. 文本切分 + 存入 chunks 表 ----
    let chunkCount = 0;
    if (segments.length > 0) {
      const chunksResult = splitTextWithMeta(
        segments,
        500,   // chunkSize
        50,    // overlap
        doc.id // documentId
      );

      for (const chunk of chunksResult) {
        await db.insert(chunks).values({
          documentId: chunk.metadata.documentId,
          content: chunk.content,
          metadata: JSON.stringify(chunk.metadata),
        });
      }

      chunkCount = chunksResult.length;

      // 异步生成向量嵌入（不阻塞上传响应）
      embedChunks(doc.id)
        .then((r) => {
          const ok = r.filter((e) => e.success).length;
          console.log(`[upload] embedding done: ${ok}/${r.length} chunks for doc ${doc.id}`);
        })
        .catch((e) =>
          console.error(`[upload] embedding failed for doc ${doc.id}:`, e)
        );
    }

    // ---- 8. 返回结果 ----
    return NextResponse.json({
      documentId: doc.id,
      name: doc.name,
      pageCount,
      segments,
      chunkCount,
    });
  } catch (error) {
    console.error("Upload API error:", error);
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}

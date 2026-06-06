import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chunks, documents } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/documents/:id/chunks
 *
 * 返回指定文档的所有 chunk 摘要（不含 embedding 向量）
 * 用于验证切分效果的调试接口，后续阶段可删除
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;

    // ---- 1. 检查文档是否存在 ----
    const [doc] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!doc) {
      return NextResponse.json(
        { error: "文档不存在" },
        { status: 404 }
      );
    }

    // ---- 2. 查询该文档的所有 chunks（不含 embedding）----
    const rows = await db
      .select({
        id: chunks.id,
        content: chunks.content,
        metadata: chunks.metadata,
      })
      .from(chunks)
      .where(eq(chunks.documentId, documentId))
      .orderBy(chunks.id);

    // ---- 3. 截断 content 为预览（> 100 字符时加 "..."）----
    const result = rows.map((row) => {
      const truncated =
        row.content.length > 100
          ? row.content.slice(0, 100) + "..."
          : row.content;

      // 解析 metadata JSON 字符串为对象
      let parsedMetadata: unknown = row.metadata;
      if (typeof row.metadata === "string") {
        try {
          parsedMetadata = JSON.parse(row.metadata);
        } catch {
          parsedMetadata = row.metadata;
        }
      }

      return {
        id: row.id,
        content: truncated,
        metadata: parsedMetadata,
      };
    });

    // ---- 4. 返回 ----
    return NextResponse.json(result);
  } catch (error) {
    console.error("Chunks API error:", error);
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}

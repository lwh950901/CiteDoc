import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/documents/:id
 *
 * 返回指定文档的完整信息（含原文全文）
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;

    const [doc] = await db
      .select({
        id: documents.id,
        name: documents.name,
        content: documents.content,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!doc) {
      return NextResponse.json(
        { error: "文档不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json(doc);
  } catch (error) {
    console.error("Document API error:", error);
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, chunks } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { embedChunks } from "@/lib/embeddings";

/**
 * GET /api/documents
 * 返回最近上传的文档 ID（用于首页自动加载）
 */
export async function GET() {
  try {
    const [doc] = await db
      .select({ id: documents.id, name: documents.name, createdAt: documents.createdAt })
      .from(documents)
      .orderBy(desc(documents.createdAt))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ documentId: null }, { status: 200 });
    }

    // 检查该文档的向量化状态
    const [status] = await db
      .select({
        total: sql<number>`count(*)`,
        embedded: sql<number>`count(case when ${chunks.embedding} is not null then 1 end)`,
      })
      .from(chunks)
      .where(eq(chunks.documentId, doc.id));

    return NextResponse.json({
      documentId: doc.id,
      name: doc.name,
      totalChunks: Number(status?.total ?? 0),
      embeddedChunks: Number(status?.embedded ?? 0),
    });
  } catch (error) {
    console.error("Documents list API error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

/**
 * POST /api/documents
 * 为指定文档生成向量嵌入
 */
export async function POST(request: NextRequest) {
  try {
    const { documentId } = (await request.json()) as { documentId?: string };
    if (!documentId) {
      return NextResponse.json({ error: "缺少 documentId" }, { status: 400 });
    }

    const results = await embedChunks(documentId);
    const ok = results.filter((r) => r.success).length;

    return NextResponse.json({ total: results.length, embedded: ok });
  } catch (error) {
    console.error("Embed API error:", error);
    return NextResponse.json({ error: "向量化失败" }, { status: 500 });
  }
}

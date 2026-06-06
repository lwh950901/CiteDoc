import { NextRequest, NextResponse } from "next/server";
import { embedChunks, getEmbeddingProgress } from "@/lib/embeddings";
import { db } from "@/lib/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";

/** 内存并发锁：防止同一文档同时触发多次向量化 */
const processing = new Set<string>();

/**
 * POST /api/documents/:id/embed
 * 手动触发指定文档的向量化
 */
export async function POST(
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

    // ---- 2. 并发锁：同一文档不可同时处理 ----
    if (processing.has(documentId)) {
      return NextResponse.json(
        { error: "该文档正在向量化中，请稍后重试" },
        { status: 409 }
      );
    }
    processing.add(documentId);

    try {
      const results = await embedChunks(documentId);
      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.length - successCount;
      const failedIds = results
        .filter((r) => !r.success)
        .map((r) => r.chunkId);

      return NextResponse.json({
        total: results.length,
        success: successCount,
        failed: failedCount,
        failedIds,
      });
    } finally {
      processing.delete(documentId);
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "向量化失败";
    // 区分 API Key 错误
    if (
      message.includes("API key") ||
      message.includes("api_key") ||
      message.includes("Unauthorized") ||
      message.includes("401")
    ) {
      return NextResponse.json(
        { error: "请检查 SILICONFLOW_API_KEY 配置" },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/documents/:id/embed
 * 查询指定文档的向量化进度
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;

    // ---- 检查文档是否存在 ----
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

    const progress = await getEmbeddingProgress(documentId);
    return NextResponse.json(progress);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

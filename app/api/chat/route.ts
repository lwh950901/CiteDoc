import { NextRequest, NextResponse } from "next/server";
import { retrieveChunks, buildQAPrompt } from "@/lib";
import type { RetrievedChunk } from "@/lib/retriever";
import OpenAI from "openai";

// ---- LLM 客户端（延迟初始化）----
let _llmClient: OpenAI | null = null;

function getLLMClient(): OpenAI {
  if (!_llmClient) {
    _llmClient = new OpenAI({
      apiKey: process.env.LLM_API_KEY,
      baseURL: process.env.LLM_BASE_URL,
    });
  }
  return _llmClient;
}

// ---- 引用解析 ----

function parseReferences(
  answer: string,
  retrieved: RetrievedChunk[]
): {
  id: number;
  page: number;
  charStart: number;
  charEnd: number;
  snippet: string;
}[] {
  const refRegex = /\[(\d+)\]/g;
  const matches = [...answer.matchAll(refRegex)];
  const uniqueRefs = [...new Set(matches.map((m) => parseInt(m[1], 10)))];

  return uniqueRefs
    .filter((ref) => ref > 0 && ref <= retrieved.length)
    .map((ref) => {
      const chunk = retrieved[ref - 1];
      return {
        id: ref,
        page: chunk.metadata.page,
        charStart: chunk.metadata.charStart,
        charEnd: chunk.metadata.charEnd,
        snippet: chunk.content.slice(0, 100),
      };
    });
}

// ---- API 端点 ----

/**
 * POST /api/chat
 * 文档问答：检索 → Prompt 构建 → LLM 生成 → 引用解析
 */
export async function POST(req: NextRequest) {
  try {
    const { documentId, question } = (await req.json()) as {
      documentId?: string;
      question?: string;
    };

    // ---- 1. 参数校验 ----
    if (!documentId || !question) {
      return NextResponse.json(
        { error: "缺少 documentId 或 question" },
        { status: 400 }
      );
    }

    // ---- 2. 向量检索 ----
    const retrieved = await retrieveChunks(question, documentId, 4);

    if (retrieved.length === 0) {
      return NextResponse.json({
        answer: "文档中未找到相关信息。",
        sources: [],
      });
    }

    // ---- 3. 构建 Prompt ----
    const { systemPrompt, userMessage } = buildQAPrompt(question, retrieved);

    // ---- 4. 调用 LLM（非流式）----
    const completion = await getLLMClient().chat.completions.create({
      model: process.env.LLM_MODEL || "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
    });

    const rawAnswer =
      completion.choices[0]?.message?.content || "无法获取回答。";

    // ---- 5. 解析引用 ----
    const sources = parseReferences(rawAnswer, retrieved);

    return NextResponse.json({
      answer: rawAnswer,
      sources,
    });
  } catch (err: unknown) {
    // 提取错误信息（OpenAI SDK 错误可能有多层结构）
    let message = "服务器内部错误";
    if (err instanceof Error) {
      message = err.message;
      // OpenAI APIError 有更详细的 message
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiErr = err as any;
      if (apiErr.error?.message) {
        message = apiErr.error.message;
      }
    }
    console.error("Chat API error:", err);

    // 区分认证错误
    if (
      message.includes("API key") ||
      message.includes("api_key") ||
      message.includes("OPENAI_API_KEY") ||
      message.includes("Unauthorized") ||
      message.includes("401") ||
      message.includes("Authentication")
    ) {
      return NextResponse.json(
        { error: "LLM 调用失败，请检查 LLM_API_KEY 配置" },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

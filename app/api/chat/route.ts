import { NextRequest } from "next/server";
import { retrieveChunks, buildQAPrompt } from "@/lib";
import type { RetrievedChunk } from "@/lib/retriever";
import type { Source } from "@/lib/types";
import OpenAI from "openai";

// ---- 常量 ----

const LLM_TIMEOUT_MS = 30_000;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;

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

// ---- SSE 辅助函数 ----

const encoder = new TextEncoder();

function sseEvent(event: string, data: string): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${data}\n\n`);
}

function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, { headers: SSE_HEADERS });
}

function streamError(message: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(sseEvent("error", JSON.stringify(message)));
      controller.close();
    },
  });
}

function streamNoResult(): ReadableStream<Uint8Array> {
  const msg = "文档中未找到相关信息。";
  return new ReadableStream({
    start(controller) {
      controller.enqueue(sseEvent("sources", "[]"));
      for (const char of msg) {
        controller.enqueue(sseEvent("text", JSON.stringify(char)));
      }
      controller.enqueue(sseEvent("done", "[DONE]"));
      controller.close();
    },
  });
}

// ---- 引用解析 ----

function parseReferences(
  answer: string,
  retrieved: RetrievedChunk[]
): Source[] {
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
        chunkId: chunk.id,
        charStart: chunk.metadata.charStart,
        charEnd: chunk.metadata.charEnd,
        snippet: chunk.content.slice(0, 100),
      };
    });
}

// ---- API 端点 ----

/**
 * POST /api/chat
 * 文档问答 SSE 流式端点：检索 → Prompt 构建 → LLM 生成 → 引用解析 → SSE 流
 */
export async function POST(req: NextRequest) {
  try {
    const { documentId, question } = (await req.json()) as {
      documentId?: string;
      question?: string;
    };

    // ---- 1. 参数校验 ----
    if (!documentId || !question) {
      return sseResponse(streamError("缺少 documentId 或 question"));
    }

    // ---- 2. 向量检索 ----
    const retrieved = await retrieveChunks(question, documentId, 4);

    if (retrieved.length === 0) {
      return sseResponse(streamNoResult());
    }

    // ---- 3. 构建 Prompt ----
    const { systemPrompt, userMessage } = buildQAPrompt(question, retrieved);

    // ---- 4. 调用 LLM（非流式，30s 超时）----
    const completion = await getLLMClient().chat.completions.create(
      {
        model: process.env.LLM_MODEL || "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
      },
      { timeout: LLM_TIMEOUT_MS }
    );

    const rawAnswer =
      completion.choices[0]?.message?.content || "无法获取回答。";

    // ---- 5. 解析引用 ----
    const sources = parseReferences(rawAnswer, retrieved);

    // ---- 6. 创建 SSE 流 ----
    const stream = new ReadableStream({
      start(controller) {
        // 事件1: 发送溯源元数据
        controller.enqueue(
          sseEvent("sources", JSON.stringify(sources))
        );
        // 事件2: 逐字发送答案文本（前端打字机效果渲染）
        for (const char of rawAnswer) {
          controller.enqueue(sseEvent("text", JSON.stringify(char)));
        }
        // 事件3: 结束
        controller.enqueue(sseEvent("done", "[DONE]"));
        controller.close();
      },
    });

    return sseResponse(stream);
  } catch (err: unknown) {
    // 提取错误信息（OpenAI SDK 错误可能有多层结构）
    let message = "服务器内部错误";
    if (err instanceof Error) {
      message = err.message;
      const apiErr = err as unknown as Record<string, unknown>;
      if (
        apiErr.error &&
        typeof apiErr.error === "object" &&
        apiErr.error !== null &&
        "message" in apiErr.error
      ) {
        const em = (apiErr.error as Record<string, unknown>).message;
        message = typeof em === "string" ? em : String(em);
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
      return sseResponse(
        streamError("LLM 调用失败，请检查 LLM_API_KEY 配置")
      );
    }

    return sseResponse(streamError(message));
  }
}

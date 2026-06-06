import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

export const runtime = "edge";

// DeepSeek API 兼容 OpenAI 格式，通过自定义 baseURL 对接
const deepseek = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

export async function POST() {
  try {
    // 使用 Vercel AI SDK 流式返回固定的测试消息
    // 验证 DeepSeek 连接和 Streaming 管道是否正常工作
    const result = streamText({
      model: deepseek("deepseek-chat"),
      system:
        "You are a test assistant. Reply ONLY with the following exact message, nothing else.",
      prompt:
        'Reply with exactly this message: "👋 环境已就绪，AI 连接成功！"',
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "AI 服务调用失败，请检查 DEEPSEEK_API_KEY 配置" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

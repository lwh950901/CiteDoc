import { NextResponse } from "next/server";
import { getServerEnvModel, isServerEnvConfigured } from "@/lib/llm-config";

/** GET /api/llm-config — 检测服务端 LLM env 配置状态（不返回密钥） */
export async function GET() {
  if (isServerEnvConfigured()) {
    return NextResponse.json({
      configured: true,
      source: "env",
      model: getServerEnvModel(),
    });
  }

  return NextResponse.json({
    configured: false,
    source: "none",
  });
}

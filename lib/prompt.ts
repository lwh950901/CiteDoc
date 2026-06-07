import type { RetrievedChunk } from "./retriever";

/**
 * 构建 RAG 问答 Prompt，将检索到的 chunk 标为 [1] [2] ...
 *
 * @returns systemPrompt（约束 LLM 行为）和 userMessage（上下文 + 问题）
 */
export function buildQAPrompt(
  question: string,
  chunks: RetrievedChunk[]
): { systemPrompt: string; userMessage: string } {
  // 将 chunk 编为 [1] [2] 等
  const contexts = chunks
    .map((c, i) => `[${i + 1}] ${c.content}`)
    .join("\n\n");

  const systemPrompt = `你是一个严谨的文档助手，只能基于下面提供的文档片段回答问题。
如果文档片段不足以回答问题，请明确说"根据现有资料无法回答"，不要编造信息。
回答时，如果引用某个片段，请使用 [序号] 标记，例如 "根据文档，2025年销售额增长了12%[1]"。`;

  const userMessage = `文档片段：
${contexts}

问题：${question}`;

  return { systemPrompt, userMessage };
}

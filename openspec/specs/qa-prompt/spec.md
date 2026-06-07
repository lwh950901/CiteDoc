## ADDED Requirements

### Requirement: Build QA Prompt with citation markers

系统 SHALL 提供 `buildQAPrompt` 函数，将检索到的 chunk 数组拼接为带 `[序号]` 标记的上下文字符串，生成 system prompt 和 user message，要求 LLM 基于资料回答并在引用处标注序号。

#### Scenario: Normal prompt building

- **WHEN** 传入问题 "什么是 DocQATracer?" 和 3 个检索到的 chunk
- **THEN** `userMessage` 中包含 "文档片段：" 后接 `[1] chunk内容\n\n[2] chunk内容\n\n[3] chunk内容`
- **AND** `systemPrompt` 要求 LLM "只能基于下面提供的文档片段回答问题" 且 "使用 [序号] 标记引用"
- **AND** `userMessage` 末尾包含 "问题：什么是 DocQATracer?"

#### Scenario: Empty chunks

- **WHEN** 传入空数组 `[]`
- **THEN** `userMessage` 中 "文档片段：" 后无内容
- **AND** system prompt 仍然保留引用格式说明

### Requirement: No fabrication constraint

systemPrompt SHALL 包含明确约束：如果文档片段不足以回答问题，LLM 必须说"根据现有资料无法回答"，不得编造信息。

#### Scenario: Insufficient context

- **WHEN** LLM 判断所有 chunk 均不包含问题所需信息
- **THEN** LLM 回答应为 "根据现有资料无法回答" 或等效表述
- **AND** 不应包含编造的引用标记

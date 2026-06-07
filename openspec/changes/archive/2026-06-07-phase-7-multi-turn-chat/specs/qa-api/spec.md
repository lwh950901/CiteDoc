## qa-api (delta)

修改 `POST /api/chat` 以支持多轮对话和增强错误处理。

### Modified Requirements

#### 1. History 字段
- 请求体 MUST 支持可选 `history: Array<{ role: 'user' | 'assistant'; content: string }>`
- 兼容：不传 `history` 时行为不变（向后兼容）

#### 2. 错误状态码细化
- 替换当前的通用 500 错误响应，区分 400/429/500/504
- LLM 超时 MUST 返回 504
- API Key 无效 MUST 返回明确提示消息

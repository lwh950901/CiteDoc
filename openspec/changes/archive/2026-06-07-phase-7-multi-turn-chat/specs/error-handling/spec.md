## error-handling

全流程错误处理与状态覆盖——API 状态码规范化、组件六状态、边界场景保护。

### Requirements

#### 1. API 状态码规范
- 所有 API 错误返回 MUST 包含结构化 JSON `{ "error": "人类可读描述" }`
- 状态码 MUST 遵循：`400` 参数错误、`404` 不存在、`413` 文件过大、`429` 限流、`500` 内部错误、`504` 超时
- LLM/Embedding 调用 MUST 单独 catch，区分"服务商报错"和"网络超时"
- 网络超时 MUST 返回 504 + "AI 服务响应超时，请稍后重试"
- API Key 无效 MUST 返回 500 + "AI 服务配置错误，请联系管理员"
- SSE 流式接口中的错误 MUST 通过 `event: error` 事件通知前端

#### 2. 组件六状态覆盖
- 每个组件 MUST 覆盖：idle（引导）、loading（骨架/转圈）、empty（"暂无数据"）、error（红色提示+重试）、streaming（光标闪烁）、no-result（"未找到相关信息"）

#### 3. 边界场景保护
- 上传非 PDF/Word → 提示 "仅支持 PDF 和 Word 文件"
- 文件 > 10MB → "文件大小不能超过 10MB"
- PDF 加密/损坏 → "文档解析失败，请确认文件未加密或损坏"
- 网络断开 → "网络连接异常，请检查网络"
- 用户中断流式回答 → AbortController 取消，正常恢复输入
- 原文超长（>500KB）→ DocumentViewer 截断 + "查看完整文档"按钮

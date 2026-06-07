## qa-ui (delta)

修改 ChatPanel 从单答案模式改为多轮对话气泡模式。

### Modified Requirements

#### 1. 消息列表
- 从单 `answer` + `sources` 状态改为 `messages` 数组
- 每条消息 MUST 包含 role（user/assistant）、content、sources（仅 assistant）

#### 2. 对话气泡渲染
- user 消息 MUST 右对齐蓝底
- assistant 消息 MUST 左对齐灰底，角标保持可点击溯源

#### 3. 新增状态覆盖
- streaming 状态 MUST 显示打字光标
- no-result 状态 MUST 显示 "文档中未找到相关信息，请尝试换一种问法"

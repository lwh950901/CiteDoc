## ux-polish

用户体验打磨——上传进度、键盘交互、自动滚动、高亮淡出、移动端适配、空状态引导。

### Requirements

#### 1. 上传进度可视化
- 上传成功后 MUST 展示向量化进度条（轮询 `GET /api/documents/:id/embed`）
- 进度条 MUST 显示 "正在处理文档... N/M 块已向量化"
- 向量化完成前，"发送"按钮 MUST 为 disabled 状态并提示等待

#### 2. 键盘交互
- 输入框 MUST 支持 Enter 发送
- Shift+Enter MUST 换行（textarea 替代 input）
- 发送后 MUST 自动清空输入框

#### 3. 自动滚动
- 对话区域 MUST 在新消息到达时自动滚动到底部（`scrollIntoView`）

#### 4. 高亮淡出
- 角标点击后的高亮效果 MUST 在 3 秒后自动淡出（`setTimeout` 清除 `activeChunkId`）

#### 5. 移动端适配
- < 768px 宽度时双栏 MUST 切换为上下布局
- 对话区在上，原文区在下
- 角标点击时移动端 MUST 自动滚动到原文对应位置

#### 6. 空状态引导
- 无文档时 MUST 显示引导文案 "上传你的第一份文档开始提问"

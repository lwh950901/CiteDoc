## 1. DocUploadPanel 文件校验

- [x] 1.1 `app/page.tsx`: 添加 ALLOWED MIME 类型常量
- [x] 1.2 `app/page.tsx`: handleFile 中校验文件类型（不匹配 → setError）
- [x] 1.3 `app/page.tsx`: handleFile 中校验文件大小（>10MB → setError）

## 2. FileUpload 死代码清理

- [x] 2.1 删除 `components/FileUpload.tsx`

## 3. ChatPanel history 捕获健壮性

- [x] 3.1 `components/ChatPanel.tsx`: 添加 `completedHistoryRef`
- [x] 3.2 user 消息发送时追加到 ref
- [x] 3.3 assistant 回答完成时追加到 ref
- [x] 3.4 `handleAsk` 从 ref 读取 history（替代 setMessages + setTimeout(0)）

## 4. 验证

- [x] 4.1 `npx tsc --noEmit` TypeScript 编译通过
- [x] 4.2 浏览器：文档加载 + 问答正常

## Design

代码 review 发现的三项修复，均为实现层面改进，不涉及架构变更。

### 1. DocUploadPanel 文件前置校验

在 `handleFile` 函数中，发起 API 请求前增加客户端校验：

```ts
const ALLOWED = ["application/pdf", "application/vnd..."];
if (!ALLOWED.includes(file.type)) { setError("仅支持 PDF 和 DOCX 文件"); return; }
if (file.size > 10 * 1024 * 1024) { setError("文件不能超过 10MB"); return; }
```

校验失败时不发起 API 请求，直接用 `setError` 展示提示。后端 API 的校验作为第二道防线保留。

### 2. FileUpload 死代码

`components/FileUpload.tsx` 已无任何引用（page.tsx 改用 DocUploadPanel + DocumentViewer 管理文档），直接删除。

### 3. ChatPanel history 健壮性

原方案：`setMessages` 函数式更新捕获 → `setTimeout(0)` 等待 React flush → 读取局部 history 数组。依赖隐式批处理时序。

新方案：引入 `completedHistoryRef: useRef<{role, content}[]>([])`：
- user 消息发送时 `completedHistoryRef.current.push({role:"user", content:q})`
- assistant 完成时 `completedHistoryRef.current.push({role:"assistant", content:answer})`
- `handleAsk` 中 `const history = completedHistoryRef.current.slice()`

ref 同步写入，无时序依赖，在 React 并发模式下安全。

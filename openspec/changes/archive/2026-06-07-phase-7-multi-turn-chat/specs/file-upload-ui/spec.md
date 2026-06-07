## file-upload-ui (delta)

修改 FileUpload 新增向量化进度条和提问禁用逻辑。

### Modified Requirements

#### 1. 向量化进度
- 上传成功后 MUST 轮询 `GET /api/documents/:id/embed` 获取进度
- MUST 显示 "正在处理文档... N/M 块已向量化" 进度文案
- 向量化完成前，"发送"按钮 MUST 为 disabled + 提示等待

#### 2. 进度回调
- 向量化完成后 MUST 回调通知父组件（`onReady` prop），解锁问答功能

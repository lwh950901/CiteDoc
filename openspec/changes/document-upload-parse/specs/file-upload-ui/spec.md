# Spec: File Upload UI

## ADDED Requirements

### Requirement: FileUpload component with four states

系统 SHALL 提供一个 `FileUpload` 组件，覆盖 idle（等待选择）、uploading（上传中）、success（上传成功）、error（上传失败）四种状态。

#### Scenario: Idle state

- **WHEN** 组件初次渲染，用户尚未选择文件
- **THEN** 显示文件选择器（accept=".pdf,.docx"）和上传按钮
- **AND** 上传按钮处于可点击状态

#### Scenario: Uploading state

- **WHEN** 用户点击上传按钮，文件开始上传
- **THEN** 上传按钮变为 disabled 状态，显示"上传中..."
- **AND** 显示进度提示

#### Scenario: Success state

- **WHEN** 上传成功后
- **THEN** 显示上传成功提示、文档 ID 和段落预览（前 5 个 segment）
- **AND** 用户可以选择继续上传新文件

#### Scenario: Error state

- **WHEN** 上传失败（网络错误或服务端返回错误）
- **THEN** 显示错误消息
- **AND** 用户可重新上传

### Requirement: Integration with main page

`app/page.tsx` SHALL 集成 `FileUpload` 组件，上传成功后展示返回的 segment 预览信息。

#### Scenario: Upload from main page

- **WHEN** 用户在主页面上传文件成功
- **THEN** 页面展示返回的 `documentId` 和前 5 个 segment 的页码及内容摘要

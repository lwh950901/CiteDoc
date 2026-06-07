## MODIFIED Requirements

### Requirement: FileUpload component with four states

系统 SHALL 提供一个 `FileUpload` 组件，覆盖 idle（等待选择）、uploading（上传中）、success（上传成功-紧凑模式）、error（上传失败）四种状态。上传成功后 SHALL 收缩为紧凑状态栏（一行显示文件名 + "换文件"按钮），释放垂直空间供下方双栏使用。

#### Scenario: Idle state

- **WHEN** 组件初次渲染，用户尚未选择文件
- **THEN** 显示文件选择器（accept=".pdf,.docx"）和上传按钮
- **AND** 上传按钮处于可点击状态

#### Scenario: Uploading state

- **WHEN** 用户点击上传按钮，文件开始上传
- **THEN** 上传按钮变为 disabled 状态，显示"上传中..."
- **AND** 显示进度提示

#### Scenario: Success state (compact)

- **WHEN** 上传成功后
- **THEN** 显示一行紧凑状态栏：`✅ {文件名} 上传成功（{页数}页, {段落数}段）` + `← 换文件` 按钮
- **AND** 状态栏高度不超过 40px，不占据额外垂直空间

#### Scenario: Expand success details

- **WHEN** 用户点击紧凑状态栏中的文件名
- **THEN** 展开显示段落预览（前 5 个 segment）和文档 ID（可选）

#### Scenario: Error state

- **WHEN** 上传失败（网络错误或服务端返回错误）
- **THEN** 显示错误消息
- **AND** 用户可重新上传

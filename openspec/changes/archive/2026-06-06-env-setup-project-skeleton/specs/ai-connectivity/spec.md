# Spec: AI Connectivity Verification

## ADDED Requirements

### Requirement: Streaming Chat API Endpoint

A test API route must verify that the OpenAI connection works via Vercel AI SDK with streaming.

#### Scenario: User sends a test message

- **WHEN** a POST request is sent to `/api/chat` with `{ messages: [{ role: "user", content: "test" }] }`
- **THEN** the response is a streaming text/event-stream
- **AND** the stream contains the fixed message "👋 环境已就绪，AI 连接成功！"

#### Scenario: Test button on frontend triggers streaming

- **WHEN** the user clicks "测试连接" button on the root page
- **THEN** the response text appears character by character (streaming)
- **AND** no 401 or other errors occur

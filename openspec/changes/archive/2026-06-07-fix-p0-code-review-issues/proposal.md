## Why

Phase 5-6 code review 发现 12 个问题，其中 1 个 P0（LLM 无超时）、2 个 P1（Timer 泄漏、chunks 错误静默）、3 个 P2（SSE headers 重复、Source 接口重复、缺少 useMemo 优化）。这些影响系统稳定性和代码可维护性，需在继续 Phase 7 前修复。

## What Changes

- **LLM API 超时**: 服务端 `chat.completions.create()` 添加 30s timeout，客户端 fetch 添加 `AbortSignal.timeout()`
- **Typewriter Timer 清理**: ChatPanel 添加 `useEffect` 清理函数，组件卸载时清除 `setInterval`
- **Chunks 错误处理**: DocumentViewer 在 chunks API 失败时输出 console.error，避免溯源功能静默失效
- **SSE Headers 去重**: 提取重复 5 次的 headers 对象为常量 `SSE_HEADERS`，新增 `sseResponse()` helper
- **Source 接口共享**: 从 route.ts 和 ChatPanel.tsx 提取 Source 接口到 `lib/types.ts`
- **useMemo 优化**: DocumentViewer 的 sorted chunks 和 ChatPanel 的 renderAnswer 使用 useMemo 缓存

## Capabilities

### New Capabilities
- `code-quality-fixes`: P0/P1/P2 代码质量修复，覆盖超时、内存泄漏、错误处理、代码去重、性能优化

### Modified Capabilities
<!-- No existing capability spec changes — these are implementation-level fixes -->
<!-- (none) -->

## Impact

- **Affected files**: `app/api/chat/route.ts`, `components/ChatPanel.tsx`, `components/DocumentViewer.tsx`, `lib/types.ts` (new)
- **API changes**: 无 breaking changes，仅增强错误处理和超时
- **Browser testing**: 验证打字机效果、错误状态、超时行为

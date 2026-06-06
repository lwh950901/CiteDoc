## Why

Code review of Phase 3-4 identified 1 Critical and 2 High-severity defects in the embedding subsystem. These bugs cause incorrect API response types (string vs number), missing error handling for non-existent documents, and lack of concurrency protection — all of which degrade API reliability and frontend integration correctness. Fix them before proceeding to Phase 5.

## What Changes

- **Fix `getEmbeddingProgress` return type**: PostgreSQL count values arrive as strings — explicitly convert to `number` with `Number()` so the function contract matches its declared return type `{ total: number, embedded: number }`.
- **Add document existence validation to embed API**: Both `POST` and `GET` endpoints at `/api/documents/[id]/embed` will validate the document exists before processing, returning 404 for unknown document IDs instead of silently returning `total: 0`.
- **Add in-memory concurrency lock to embed API**: Prevent duplicate embedding runs triggered by rapid successive `POST` requests with a simple `Set<string>`-based lock, matching the original design decision (D5) that was deferred.

## Capabilities

### New Capabilities

<!-- No new capabilities — these are bug fixes to existing behavior -->

### Modified Capabilities

- `embedding-generation`: `getEmbeddingProgress` return value type corrected from runtime string to declared `number`; embed POST endpoint gains concurrency guard.
- `embedding-api`: POST and GET endpoints gain document existence validation with proper 404 response.

## Impact

- **Files affected**: `lib/embeddings.ts` (C-1), `app/api/documents/[id]/embed/route.ts` (H-1, H-2)
- **API contract**: No breaking changes; return types become more correct (string → number is backward-compatible for most JS consumers)
- **No new dependencies**: In-memory `Set` requires no external packages

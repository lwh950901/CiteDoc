## Context

Phase 3-4 code review found 3 defects ranked P0 (Critical + High) in the embedding subsystem. These span two files and two spec capabilities. All are isolated single-function fixes — no cross-module refactoring needed.

Current state:
- `lib/embeddings.ts` — `getEmbeddingProgress` declares return type `{ total: number, embedded: number }` but PostgreSQL `count(*)` via `sql<number>` returns strings at runtime
- `app/api/documents/[id]/embed/route.ts` — POST/GET endpoints accept any document ID without verifying the document exists in the database
- `app/api/documents/[id]/embed/route.ts` — POST endpoint has no guard against concurrent duplicate invocations for the same document

## Goals / Non-Goals

**Goals:**
- Fix C-1: `getEmbeddingProgress` always returns actual `number` values matching its TypeScript type contract
- Fix H-1: embed API returns 404 for non-existent document IDs instead of 200 + fake empty results
- Fix H-2: concurrent POST requests for the same document are rejected with 409 instead of silently double-running embedding

**Non-Goals:**
- Fixing Medium/Low review items (M-1 through L-5) — these remain deferred
- Adding distributed locking (Redis, DB advisory lock) — memory lock is sufficient for single-instance MVP
- Changing the embedding API response shape
- Adding automated tests for the fixes (no test infrastructure yet in this project)

## Decisions

### D1: `Number()` conversion at return site vs in SQL query

**Chosen**: `Number()` wrapper at return statement in `getEmbeddingProgress`.

```ts
return {
  total: Number(totalRow?.count ?? 0),
  embedded: Number(embeddedRow?.count ?? 0),
};
```

**Alternative considered**: Cast in SQL via `sql<number>` + `::int` in the query string. Rejected because Drizzle's `sql<number>` template tag only affects TypeScript type inference — it does NOT change PostgreSQL's wire protocol behavior. The `Number()` approach is explicit, auditable, and idiomatic JS.

### D2: Document existence check — inline in route vs shared helper

**Chosen**: Inline check in each endpoint handler, following the exact pattern from `app/api/documents/[id]/chunks/route.ts:19-29`.

```ts
const [doc] = await db
  .select({ id: documents.id })
  .from(documents)
  .where(eq(documents.id, documentId));
if (!doc) {
  return NextResponse.json({ error: "文档不存在" }, { status: 404 });
}
```

**Alternative considered**: Extract to a shared `validateDocument(id)` helper. Rejected for now — only 2 call sites, and introducing a new shared module for one query adds indirection with minimal benefit.

### D3: Concurrency lock — module-level `Set<string>` vs `Map<string, Promise>`

**Chosen**: Module-level `Set<string>` (document IDs currently being processed). POST handler checks `if (processing.has(id))` → 409 Conflict. Otherwise adds to set, awaits `embedChunks`, removes in `finally`.

```ts
const processing = new Set<string>();

export async function POST(...) {
  const { id } = await params;
  if (processing.has(id)) {
    return NextResponse.json(
      { error: "该文档正在向量化中，请稍后重试" },
      { status: 409 }
    );
  }
  processing.add(id);
  try {
    // ... existing logic
  } finally {
    processing.delete(id);
  }
}
```

**Alternative considered**: `Map<string, Promise<EmbeddingResult[]>>` to return the same promise to concurrent callers. Rejected because it adds complexity (need to handle Promise rejection cleanup) and the simpler 409 approach is clearer — the caller knows to retry.

### D4: Lock scope — document-level only

The lock key is the document ID. Two concurrent POSTs for *different* documents are allowed to run in parallel — they don't conflict (different chunks, different API calls). Only same-document concurrent invocations are blocked.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Memory lock lost on process restart (server restart clears `Set`) | Acceptable for MVP — no active embedding runs survive a restart anyway |
| Memory lock doesn't work across multiple server instances (horizontal scaling) | Acceptable for MVP — single-instance deployment. Upgrade to DB advisory lock (`pg_try_advisory_lock`) if horizontal scaling is added |
| `Number()` on `undefined` (if `totalRow` is `undefined`) produces `NaN` | `?? 0` guard handles `undefined` first — `Number(0)` = `0`, never `NaN` |
| 409 Conflict is not a standard HTTP status for "already in progress" | 409 is the closest standard code (conflict with current resource state). Alternative 429 Too Many Requests could work too but implies rate-limiting rather than locking |

# Design: Environment Setup & Project Skeleton

## Context

Starting from an empty repository (only prompts/ and README.md). Need to bootstrap a full Next.js 14+ project with all the RAG infrastructure dependencies before any feature work.

## Goals / Non-Goals

**Goals:**
- Bootable Next.js project with TypeScript strict mode
- Docker Compose for local pgvector database
- Drizzle ORM schema matching the project specification exactly
- Working AI streaming endpoint to validate the OpenAI key
- Minimal frontend to confirm end-to-end connectivity

**Non-Goals:**
- No actual RAG logic (document parsing, embedding, retrieval) — that's step 2+
- No frontend design polish — just functional verification
- No production deployment configuration

## Decisions

### Decision 1: Use `create-next-app` with specific flags

Use `npx create-next-app@latest doc-qa-tracer --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"` then rename/move into current directory. This gives us the standard Next.js 14+ App Router setup without reinventing boilerplate.

**Rationale:** Standard tooling, zero manual webpack/vite config, community-standard structure.

### Decision 2: Use `drizzle-kit push:pg` for initial migration

Rather than setting up a full migration runner script, use `drizzle-kit push:pg` for the MVP phase. It directly syncs the schema to the database.

**Rationale:** Faster iteration during early development. A proper migration workflow can be added later when the schema stabilizes.

### Decision 3: Test endpoint returns a fixed string, not a real LLM call

The `/api/chat` endpoint for this phase uses `OpenAIStream` from Vercel AI SDK to stream a simple fixed message. This validates the SDK integration, API key, and streaming pipeline without consuming tokens on every test.

**Rationale:** Proves the entire pipeline works (Docker → DB → Next.js → AI SDK → Frontend streaming) with minimal cost and complexity.

### Decision 4: Use `@vercel/postgres` for the DB connection

Use Vercel's Postgres client as the underlying connection pool for Drizzle. It works identically for local Docker and Vercel Postgres in production.

**Rationale:** Single connection setup that works for both dev and prod without code changes.

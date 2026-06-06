# Proposal: Environment Setup & Project Skeleton

## Why

DocQATracer needs a solid foundation before any feature work can begin. Without a running Next.js project, database connection, and verified AI pipeline, no RAG logic can be developed or tested.

## What Changes

- Initialize a Next.js 14+ project with TypeScript, Tailwind CSS, and ESLint
- Set up PostgreSQL + pgvector via Docker Compose for local development
- Install all required dependencies (Vercel AI SDK, Drizzle ORM, LangChain, document parsers)
- Define database schema (documents + chunks tables) with Drizzle ORM
- Create a test AI chat endpoint to verify the full pipeline works end-to-end
- Build a minimal frontend with `useChat` hook to confirm streaming works

## Capabilities

### New Capabilities
- `env-setup`: Dockerized pgvector database with Drizzle ORM schema and migrations
- `ai-connectivity`: Streaming chat API endpoint using Vercel AI SDK verified with OpenAI

## Impact

- Root: `docker-compose.yml`, `.env.local`, `package.json`, config files
- `db/schema.ts`, `db/migrate.ts`, `lib/db.ts` — Database layer
- `app/api/chat/route.ts` — Test AI endpoint
- `app/page.tsx`, `app/layout.tsx` — Minimal frontend

# Tasks: Environment Setup & Project Skeleton

## 1. Project Initialization

- [x] 1.1 Create Next.js project with TypeScript + Tailwind + ESLint + App Router
- [x] 1.2 Create directory structure: `app/api/upload/`, `app/api/chat/`, `app/api/documents/`, `components/`, `lib/`, `db/`
- [x] 1.3 Create `docker-compose.yml` with pgvector/pgvector:pg16
- [x] 1.4 Create `.env.local` with DATABASE_URL and OPENAI_API_KEY

## 2. Dependencies

- [x] 2.1 Install runtime dependencies: ai, @langchain/core, @langchain/openai, @langchain/community, pg, drizzle-orm, @vercel/postgres, pdf-parse, mammoth, uuid
- [x] 2.2 Install dev dependencies: drizzle-kit

## 3. Database Layer

- [x] 3.1 Create `db/schema.ts` with documents and chunks tables (Drizzle ORM)
- [x] 3.2 Configure `drizzle.config.ts`
- [x] 3.3 Create `lib/db.ts` database connection utility
- [x] 3.4 Generate and run database migration

## 4. AI Connectivity Verification

- [x] 4.1 Create `app/api/chat/route.ts` with streaming test endpoint
- [x] 4.2 Update `app/page.tsx` with `useChat` hook and test button
- [x] 4.3 Update `app/layout.tsx` with proper metadata

## 5. Documentation

- [x] 5.1 Write `README.md` with setup and run instructions

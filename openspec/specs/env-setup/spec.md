# Spec: Environment Setup

## ADDED Requirements

### Requirement: Dockerized PostgreSQL with pgvector

The development database must run locally via Docker Compose with the pgvector extension enabled.

#### Scenario: Developer starts the database

- **WHEN** the developer runs `docker-compose up -d`
- **THEN** a PostgreSQL 16 container starts on port 5432
- **AND** the `docqa` database is accessible with user `postgres` / password `postgres`
- **AND** the pgvector extension is available

#### Scenario: Data persists across container restarts

- **WHEN** the container is stopped and restarted
- **THEN** all previously stored data remains intact via Docker volumes

---

### Requirement: Drizzle ORM Schema & Migrations

The database schema must be defined using Drizzle ORM with TypeScript types.

#### Scenario: Schema defines documents and chunks tables

- **WHEN** `db/schema.ts` is compiled
- **THEN** a `documents` table exists with columns: id (uuid), name (text), content (text), created_at (timestamp)
- **AND** a `chunks` table exists with columns: id (uuid), document_id (uuid FK), content (text), embedding (vector(1536)), metadata (text/JSON)
- **AND** an HNSW index exists on the embedding column using cosine distance

#### Scenario: Migration can be generated and applied

- **WHEN** `npx drizzle-kit generate:pg` is run
- **THEN** SQL migration files are generated in `db/migrations/`
- **WHEN** `npx drizzle-kit push:pg` is run
- **THEN** the tables are created in the database

---

### Requirement: Database Connection Utility

A reusable `db` instance must be exported for use across the application.

#### Scenario: Importing db for queries

- **WHEN** `import { db } from '@/lib/db'` is used in any server file
- **THEN** a valid Drizzle ORM instance connected to the configured database is returned

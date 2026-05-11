# ANC-62 — Design

## Overview
Use the existing `ConfigModule` to feed a shared database config into both runtime Nest and a standalone TypeORM `data-source.ts`. Keep schema management migration-first.

## Decisions
- `TypeOrmModule.forRootAsync` in `AppModule`
- `synchronize: false`
- Shared `database.config.ts` for runtime + CLI parity
- Bun-safe TypeORM CLI wrapper scripts
- One minimal `schema_health` entity/table for pipeline validation

## Baseline migration
- Idempotent `CREATE EXTENSION IF NOT EXISTS vector;`
- Idempotent `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
- No generated domain schema yet

## Boundary
This change only establishes persistence plumbing. Domain tables come later.

# ANC-62 — Tasks

## Phase 1: config
- [x] Add `.env.example` with DB variables
- [x] Rewrite `database.config.ts` to expose runtime-friendly DB settings

## Phase 2: runtime wiring
- [x] Wire `TypeOrmModule.forRootAsync` in `AppModule`
- [x] Keep `synchronize: false`

## Phase 3: CLI wiring
- [x] Add `apps/nest/src/data-source.ts`
- [x] Add Bun-safe migration scripts

## Phase 4: baseline migration
- [x] Add migrations directory
- [x] Create idempotent baseline migration for pgvector + pg_trgm
- [x] Add minimal `schema_health` entity

## Phase 5: verification
- [x] Run compile check — `bun run build:nest` passed with 0 issues
- [x] Run migration run/revert against Docker Postgres — run and revert both succeeded against pgvector/pg17
- [x] Run app bootstrap check — `nest start` bootstrapped successfully, TypeOrmCoreModule initialized

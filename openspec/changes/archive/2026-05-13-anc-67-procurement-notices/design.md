# Design: Procurement Notices Domain Feature

## Context

ANC-67 establishes the first persisted backend domain feature, replacing legacy `Convocatoria` semantics with canonical English naming (`ProcurementNotice` / `ProcurementNoticesModule`). The module lives under `apps/nest/src/modules/procurement-notices/` and is already scaffolded with entity, DTOs, repository-backed services, controller, migration, and TDD tests. It integrates with the existing TypeORM/BullMQ/Redis stack from ANC-62 and ANC-64.

## Goals / Non-Goals

**Goals:**

- Persist normalized procurement notices with a stable SECOP identifier, source metadata, and lifecycle state.
- Expose validated CRUD, search/filter/pagination, and duplicate-safe bulk ingestion.
- Track lifecycle progression from `PENDING` through enrichment/scoring to terminal decisions.
- Maintain strict TDD Jest coverage for service, controller, DTO validation, and bulk ingestion.

**Non-Goals:**

- Frontend UI changes.
- Real-time ingestion beyond queue enqueueing.
- Advanced analytics/scoring (reserved for future changes).

## Decisions

### Decision: Repository pattern with constructor injection

**Choice**: `ProcurementNoticesService` receives `Repository<ProcurementNotice>` via `@InjectRepository`.
**Alternatives considered**: Active Record, Prisma.
**Rationale**: Keeps services pure, testable with simple mocks, and consistent with the ANC-62 scaffold. Avoids introducing a second ORM.

### Decision: QueryBuilder for dynamic search

**Choice**: `search()` uses `createQueryBuilder` with conditional `andWhere` clauses and a single `getManyAndCount` call.
**Alternatives considered**: FindOptions, raw SQL.
**Rationale**: Avoids N+1 and returns pagination metadata in one round-trip. FindOptions lack composability for optional filters; raw SQL sacrifices type safety.

### Decision: BullMQ-based bulk ingestion

**Choice**: Controller enqueues a job; `ProcurementIngestionWorker` processes chunks of 50 records using `repository.upsert` on `secopId`.
**Alternatives considered**: Synchronous DB loop in controller, stored procedure.
**Rationale**: Decouples heavy workloads from HTTP lifecycle, prevents timeouts, and handles duplicates idempotently.

### Decision: class-validator DTOs with explicit decorators

**Choice**: All inputs use `class-validator` + `class-transformer` decorators.
**Alternatives considered**: Zod, Joi.
**Rationale**: NestJS native integration; automatic 400 responses without extra middleware.

### Decision: Lifecycle state as varchar

**Choice**: Stored as a simple `status` string column.
**Alternatives considered**: TypeORM enum, dedicated state machine table.
**Rationale**: Avoids rigid DB enums and allows iterative state logic in the service layer. A state table is premature for current requirements.

### Decision: Migration-backed schema with explicit registration

**Choice**: `1747120000000-ProcurementNoticesTable` creates the table, unique index on `secop_id`, and secondary indexes on `status`, `publication_date`, and `deadline_date`. `ProcurementNotice` is explicitly registered in both `typeorm.options.ts` (runtime) and `data-source.ts` (CLI/migrations).
**Alternatives considered**: `synchronize: true`.
**Rationale**: `synchronize: false` is project policy; migrations provide reproducible schema evolution and safe rollback.

## Risks / Trade-offs

- **[Risk] ILIKE on large text columns may degrade at scale** → Mitigation: leverage existing `pg_trgm` extension for GIN indexes if search volume grows; monitor query plans.
- **[Risk] Worker failure during bulk ingest could leave partial state** → Mitigation: `upsert` is idempotent by `secopId`; chunk-level try/catch isolates failures and reports them deterministically in the job result.
- **[Risk] Duplicate `secopId` outside bulk ingest relies on DB unique constraint** → Mitigation: service should catch `QueryFailedError` and map to `ConflictException` (to be hardened in apply phase).
- **[Risk] Lifecycle transitions have no guardrails yet** → Mitigation: add transition validation in service before state updates.

## Migration Plan

- The migration `1747120000000-ProcurementNoticesTable` is already in place. Rollback is supported via the `down` method which drops indexes and table.
- No data migration is required because the table is greenfield.

## Open Questions

- Should lifecycle states be formalized as a TypeScript union type to prevent invalid transitions?Si haz eso, siempre que algo se pueda tipar hazlo
- Do we need soft-delete (`deletedAt`) instead of the current hard `DELETE`? si usa soft-delete
- Should a synchronous bulk endpoint be provided for small batches (<50 rows)? Me gustaria que fuera asyncrono pero si la complejida no trae beneficios razonable dejalo asi

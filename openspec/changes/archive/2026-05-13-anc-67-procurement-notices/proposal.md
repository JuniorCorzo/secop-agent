## Why

ANC-67 turns procurement notices into the first real persisted backend domain feature. It replaces the older `Convocatoria` language with project-standard English naming and formalizes `ProcurementNotice` / `ProcurementNoticesModule` as the SECOP notice boundary for validated CRUD, search, and batch ingest.

## What Changes

- Add/align `ProcurementNotice` TypeORM persistence with migration-backed indexes and explicit runtime + CLI entity registration.
- Add DTO-validated create/update/query/bulk inputs using `class-validator` / `class-transformer`.
- Expose `ProcurementNoticesModule` API for list, detail, create, update, and duplicate-safe bulk ingest under procurement-notices naming.
- Implement repository-backed services with constructor injection, HTTP exceptions from services, optimized QueryBuilder filters/search/pagination, and no N+1 patterns.
- Add strict TDD coverage for service, controller, query behavior, duplicate handling, validation, and lifecycle semantics.
- Formalize notice lifecycle states from `PENDING` through enrichment/scoring to terminal business decisions.

## Capabilities

### New Capabilities
- `procurement-notices`: Manage persisted SECOP procurement notices, validate API inputs, search/filter/paginate efficiently, ingest batches safely, and track lifecycle progression.

### Modified Capabilities
- `convocatorias`: Replace Spanish-domain requirement language with canonical English `procurement-notices` semantics for future specs and implementation artifacts.

## Impact

| Area | Impact | Description |
|------|--------|-------------|
| `apps/nest/src/modules/procurement-notices/` | New/Modified | Entity, DTOs, repository-backed services, controller, module wiring, lifecycle behavior. |
| `apps/nest/src/migrations/` | New/Modified | Procurement notices table and indexes for stable SECOP identifiers, filtering, and search. |
| `apps/nest/src/config/typeorm.options.ts` | Modified | Register `ProcurementNotice` for app runtime. |
| `apps/nest/src/data-source.ts` | Modified | Register `ProcurementNotice` for TypeORM CLI/migrations. |
| `apps/nest/test/` | New/Modified | Jest TDD coverage for CRUD, query, validation, bulk ingest, and lifecycle edge cases. |
| `openspec/specs/convocatorias/spec.md` | Modified | Legacy capability requirements need English canonical replacement or archival path. |

## Rollback Plan

Revert procurement-notices module files, remove entity registration, and revert/drop the migration. Because no frontend dependency is included, rollback remains backend-only.

## Success Criteria

- [ ] Procurement notice endpoints validate DTO inputs and return service-level HTTP exceptions for invalid/not-found cases.
- [ ] List/search supports filters, text search, ordering, and pagination metadata with optimized DB queries.
- [ ] Bulk ingest handles duplicates and invalid rows deterministically.
- [ ] Migration creates indexed schema and entity is registered in runtime + CLI data sources.
- [ ] Strict TDD Jest coverage passes for service/controller/query/bulk/lifecycle behavior.

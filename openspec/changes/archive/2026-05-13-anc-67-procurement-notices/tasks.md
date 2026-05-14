# Tasks: Procurement Notices (ANC-67)

## Phase 1: Foundation / Entity & Migration

- [x] 1.1 Create/update `apps/nest/src/modules/procurement-notices/procurement-notice.entity.ts` — TypeORM entity with columns: `id` (PK), `secopId` (unique), `title`, `description`, `status` (varchar, default `PENDING`), `publicationDate`, `deadlineDate`, `source`, `createdAt`, `updatedAt`.
- [x] 1.2 Create/update migration `apps/nest/src/migrations/1747120000000-ProcurementNoticesTable.ts` — table + unique index on `secop_id`, secondary indexes on `status`, `publication_date`, `deadline_date`.
- [x] 1.3 Register `ProcurementNotice` entity in `apps/nest/src/config/typeorm.options.ts` (runtime) and `apps/nest/src/data-source.ts` (CLI/migrations).
- [x] 1.4 Run migration and verify table/indexes exist in DB.

## Phase 2: DTOs & Validation

- [x] 2.1 Create `apps/nest/src/modules/procurement-notices/dto/create-procurement-notice.dto.ts` — `class-validator` decorators for required/optional fields.
- [x] 2.2 Create `dto/update-procurement-notice.dto.ts` — extends partial of create DTO.
- [x] 2.3 Create `dto/query-procurement-notices.dto.ts` — filters (status, text search), pagination (page, limit), ordering (sortBy, order).
- [x] 2.4 Create `dto/bulk-ingest.dto.ts` — array of create DTOs with `@Type` and `@ValidateNested`.
- [x] 2.5 Create `dto/lifecycle-transition.dto.ts` — validates target status string.

## Phase 3: Service Layer (Repository-Backed)

- [x] 3.1 Create `apps/nest/src/modules/procurement-notices/procurement-notices.service.ts` with constructor-injected `Repository<ProcurementNotice>`.
- [x] 3.2 Implement `create(dto)` — persists notice, throws `ConflictException` on duplicate `secopId` (catch `QueryFailedError`).
- [x] 3.3 Implement `findOne(id)` / `findBySecopId(secopId)` — throws `NotFoundException` when missing.
- [x] 3.4 Implement `findAll(queryDto)` — `createQueryBuilder` with conditional `andWhere` for filters, ILIKE text search, ordering, `skip/take` pagination, returns `{ data, total, page, limit }`.
- [x] 3.5 Implement `update(id, dto)` — partial update, throws `NotFoundException`.
- [x] 3.6 Implement `bulkIngest(dtos)` — chunked `repository.upsert` on `secopId` (chunks of 50), returns `{ created, duplicates, invalid }`.
- [x] 3.7 Implement `transitionLifecycle(id, targetStatus)` — validates transition from current state, throws `BadRequestException` on invalid transition.

## Phase 4: Controller & Module Wiring

- [x] 4.1 Create `apps/nest/src/modules/procurement-notices/procurement-notices.controller.ts` — REST endpoints: `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `POST /bulk-ingest`, `PATCH /:id/lifecycle`.
- [x] 4.2 Wire `ProcurementNoticesModule` — import `TypeOrmModule.forFeature([ProcurementNotice])`, register service + controller, export service.
- [x] 4.3 Ensure module is imported in the root `AppModule` or relevant feature module.

## Phase 5: TDD — Service Tests (RED → GREEN)

- [x] 5.1 Write `procurement-notices.service.spec.ts` — unit tests for `create` (happy path + duplicate `secopId` → ConflictException).
- [x] 5.2 Test `findAll` — filters, text search, pagination metadata, empty results.
- [x] 5.3 Test `findOne` / `update` — happy path + NotFoundException.
- [x] 5.4 Test `bulkIngest` — mixed valid/duplicate/invalid rows → deterministic result.
- [x] 5.5 Test `transitionLifecycle` — valid transition advances state, invalid transition → BadRequestException.

## Phase 6: TDD — Controller Tests

- [x] 6.1 Write `procurement-notices.controller.spec.ts` — mock service, test HTTP status codes and response shapes for all endpoints.
- [x] 6.2 Test `POST /` — 201 on create, 409 on duplicate.
- [x] 6.3 Test `GET /` — 200 with pagination metadata.
- [x] 6.4 Test `GET /:id` — 200 found, 404 not found.
- [x] 6.5 Test `POST /bulk-ingest` — 200 with ingest result summary.
- [x] 6.6 Test `PATCH /:id/lifecycle` — 200 on valid transition, 400 on invalid.

## Phase 7: TDD — DTO Validation Tests

- [x] 7.1 Write validation tests for `CreateProcurementNoticeDto` — missing required fields → errors.
- [x] 7.2 Write validation tests for `QueryProcurementNoticesDto` — default pagination, invalid page/limit.
- [x] 7.3 Write validation tests for `BulkIngestDto` — nested array validation.

## Phase 8: Cleanup & Verification

- [x] 8.1 Run full test suite — all green, no regressions.
- [x] 8.2 Verify `POST /` returns 400 for invalid DTO (class-validator integration).
- [x] 8.3 Verify list/search supports filters, ordering, pagination with optimized queries (no N+1).
- [x] 8.4 Verify bulk ingest handles duplicates and invalid rows deterministically.
- [x] 8.5 Verify migration is reversible (`down` drops indexes + table).

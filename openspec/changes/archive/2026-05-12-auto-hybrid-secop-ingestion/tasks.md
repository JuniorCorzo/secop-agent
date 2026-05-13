# Tasks: Hybrid Ingestion Core

## Phase 1: Foundation — Entity, DTOs, Migration

- [x] 1.1 Create `modules/procurement-notices/entities/procurement-notice.entity.ts` — TypeORM entity with `secopId` (unique), normalized fields, `sourceMetadata: jsonb`, timestamps
- [x] 1.2 Create `modules/procurement-notices/dto/create-procurement-notice.dto.ts` — class-validator rules for manual create
- [x] 1.3 Create `modules/procurement-notices/dto/update-procurement-notice.dto.ts` — PartialType of create DTO
- [x] 1.4 Create `modules/procurement-notices/dto/bulk-ingestion.dto.ts` — `records` array with `@ArrayMaxSize(1000)` validation
- [x] 1.5 Create `modules/procurement-notices/dto/search-procurement-notice.dto.ts` — pagination (`page`, `limit`) + filter fields
- [x] 1.6 Create migration `migrations/{ts}-ProcurementNoticesTable.ts` — table, indexes, `UNIQUE(secop_id)`
- [x] 1.7 Add `ProcurementNotice` to entities array in `config/typeorm.options.ts`

## Phase 2: Core — Service, Controller

- [x] 2.1 Create `modules/procurement-notices/services/procurement-notices.service.ts` — CRUD methods + `search()` with QueryBuilder, pagination meta return
- [x] 2.2 Create `modules/procurement-notices/controllers/procurement-notices.controller.ts` — REST routes: `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `GET /` (search). Apply `JwtAuthGuard`, `RolesGuard`
- [x] 2.3 Wire `ProcurementNoticesModule` — import `TypeOrmModule.forFeature([ProcurementNotice])`, register service + controller as providers/controller

## Phase 3: Ingestion — Producer, Worker, Service

- [x] 3.1 Create `modules/queues/producers/procurement-ingestion.producer.ts` — extends `BaseQueueProducer<BulkIngestionPayload>`, injects `PROCUREMENT_NOTICE_INGESTION` queue
- [x] 3.2 Create `modules/queues/workers/procurement-ingestion.worker.ts` — `@Processor(PROCUREMENT_NOTICE_INGESTION)`, chunked upsert (size 50), returns `IngestionJobResult`
- [x] 3.3 Create `modules/procurement-notices/services/ingestion.service.ts` — validates batch, calls producer, returns `jobId`
- [x] 3.4 Add `POST /procurement-notices/bulk` route to controller — delegates to ingestion service, returns `{ jobId }`
- [x] 3.5 Register producer + worker in `modules/queues/queues.module.ts` — add `BullModule.registerQueue({ name: PROCUREMENT_NOTICE_INGESTION })`, add to providers/exports

## Phase 4: Wiring & Verification

- [x] 4.1 Update `ProcurementNoticesModule` imports — add `QueuesModule` for producer access
- [x] 4.2 Verify `app.module.ts` already imports `ProcurementNoticesModule` (or add it)
- [x] 4.3 Run migration against test DB and verify table creation
- [x] 4.4 Smoke test: `POST /procurement-notices/bulk` → returns `jobId` → worker processes → records upserted

## Phase 5: Tests

- [x] 5.1 Unit: DTO validation tests — create, update, bulk (max size), search pagination
- [x] 5.2 Unit: `ProcurementNoticesService` — CRUD methods, search filters, pagination meta
- [x] 5.3 Unit: chunking logic in worker — verify 150 records → 3 chunks of 50
- [x] 5.4 Integration: repository upsert — insert + update by `secopId`, no duplicates
- [x] 5.5 Integration: producer → worker pipeline — enqueue bulk job, verify `IngestionJobResult` counts
- [x] 5.6 E2E: `POST /procurement-notices/bulk` → queue → DB — full lifecycle with Supertest

## Dependencies / Sequencing

- Phase 1 is prerequisite for all others (entity + migration must exist first)
- Phase 2 depends on Phase 1 (service needs entity + DTOs)
- Phase 3 depends on Phase 1 (worker needs entity for upsert) and Phase 2 (controller gets bulk route)
- Phase 4 depends on Phase 2 + 3 (wiring connects everything)
- Phase 5 tasks can run per-phase but full E2E (5.6) requires all phases complete

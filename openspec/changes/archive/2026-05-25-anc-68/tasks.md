# Tasks: ANC-68 Bulk Ingestion Completion

## Phase 1: Foundation — Entity, Migration, Registration

- [x] 1.1 Create `apps/nest/src/modules/procurement-notices/entities/ingestion-job.entity.ts` — `IngestionJob` entity with UUID PK, `status` (ACCEPTED|PROCESSING|COMPLETED|PARTIAL|FAILED), `secopId`, `createdCount`, `updatedCount`, `failedCount`, `errors` JSONB, timestamps. Table name `ingestion_jobs`.
- [x] 1.2 Modify `apps/nest/src/modules/procurement-notices/entities/procurement-notice.entity.ts` — add `rawData` JSONB column (`raw_data`, nullable) distinct from `sourceMetadata`.
- [x] 1.3 Create `apps/nest/src/migrations/<timestamp>-IngestionJobsAndRawData.ts` — migration adding `ingestion_jobs` table and `procurement_notices.raw_data` column.
- [x] 1.4 Modify `apps/nest/src/config/typeorm.options.ts` — import and add `IngestionJob` to `entities` array (runtime registration).
- [x] 1.5 Modify `apps/nest/src/data-source.ts` — import and add `IngestionJob` to `entities` array (CLI/migration registration).

## Phase 2: Core — Producer, Service, Worker, Controller

- [x] 2.1 Modify `apps/nest/src/modules/queues/producers/procurement-ingestion.producer.ts` — add `ingestionJobId: string` to `ProcurementIngestionJobData` DTO.
- [x] 2.2 Modify `apps/nest/src/modules/procurement-notices/services/ingestion.service.ts` — inject `IngestionJob` repository, create ACCEPTED row before enqueue, pass `ingestionJobId` in payload, return persisted job ID.
- [x] 2.3 Modify `apps/nest/src/modules/queues/workers/procurement-ingestion.worker.ts` — inject `IngestionJob` repository + event emitter; mark PROCESSING on start, update counters per chunk, refetch persisted notices by secopId, emit `NewProcurementNoticeEvent` per notice, set terminal status (COMPLETED/PARTIAL/FAILED).
- [x] 2.4 Modify `apps/nest/src/modules/procurement-notices/controllers/procurement-notices.controller.ts` — response shape returns persistent `jobId` from `IngestionJob` (already returns `{ jobId }`, verify contract unchanged).

## Phase 3: Integration — Events, Scoring Dispatch, Module Wiring

- [x] 3.0 Modify `apps/nest/package.json` — add `@nestjs/event-emitter` dependency required for `NewProcurementNoticeEvent` publishing/listening.
- [x] 3.1 Create `apps/nest/src/modules/procurement-notices/events/new-procurement-notice.event.ts` — typed `NewProcurementNoticeEvent` class with `ingestionJobId`, `procurementNoticeId`, `secopId`, `action` ('created'|'updated').
- [x] 3.2 Create `apps/nest/src/modules/queues/producers/scoring-dispatch.producer.ts` — `ScoringDispatchProducer` extending `BaseQueueProducer<ScoringDispatchJobData>`, using `QUEUE_NAMES.SCORING`.
- [x] 3.3 Modify `apps/nest/src/modules/queues/queues.module.ts` — register `BullModule` queue for `SCORING`, add `ScoringDispatchProducer` to providers/exports, add `IngestionJob` to `TypeOrmModule.forFeature`.
- [x] 3.4 Modify `apps/nest/src/modules/procurement-notices/procurement-notices.module.ts` — add `IngestionJob` to `TypeOrmModule.forFeature`, import `EventEmitterModule` if needed.
- [x] 3.5 Modify `apps/nest/src/modules/scoring/scoring.module.ts` — import `QueuesModule`, add scoring dispatch event listener that translates `NewProcurementNoticeEvent` into `ScoringDispatchProducer.add()`.
- [x] 3.6 Modify `apps/nest/src/app.module.ts` — register `EventEmitterModule.forRoot()` once at application root so publisher and listener share same event bus.

## Phase 4: Testing

- [x] 4.1 Create `apps/nest/test/ingestion-job.entity.spec.ts` — unit: verify entity columns, defaults, status enum values match contract.
- [x] 4.2 Create `apps/nest/test/scoring-dispatch.producer.spec.ts` — unit: `ScoringDispatchProducer` validates payload, rejects invalid data, enqueues to correct queue.
- [x] 4.3 Modify `apps/nest/test/procurement-ingestion.worker.spec.ts` — add tests for: status transitions (ACCEPTED→PROCESSING→COMPLETED), counter persistence, `NewProcurementNoticeEvent` emission per notice, terminal status on partial failure, no event on failed persistence.
- [x] 4.4 Modify `apps/nest/test/procurement-notices.service.spec.ts` — add tests for: `IngestionJob` row created before enqueue, returned `jobId` matches DB row.
- [x] 4.5 Modify `apps/nest/test/typeorm.options.spec.ts` — assert `IngestionJob` present in runtime entities array. Add parallel assertion in `data-source` import check.
- [x] 4.6 Modify `apps/nest/test/procurement-notices.controller.spec.ts` — E2E-lite: bulk endpoint returns `{ jobId }` from persistent `IngestionJob`, not BullMQ-only ID.
- [x] 4.7 Create `apps/nest/test/scoring.module.spec.ts` — verify `NewProcurementNoticeEvent` listener translates one persisted notice event into one `ScoringDispatchProducer.add()` call and skips dispatch when event payload is invalid.

## Phase 5: Cleanup

- [x] 5.1 Remove `.gitkeep` files from `apps/nest/src/modules/scoring/{entities,dto,services,controllers}/` if now populated.
- [x] 5.2 Verify all existing tests pass: `bun run --cwd apps/nest test`.

# Design: ANC-68 Bulk Ingestion Completion

## Technical Approach

Extend existing `procurement-notices` async ingestion path instead of introducing a parallel Spanish flow. HTTP stays thin, BullMQ remains execution boundary, PostgreSQL becomes source of truth for `ingestion_jobs`, and scoring dispatch is triggered after successful persistence through English-named domain events.

## Architecture Decisions

### Decision: DB-backed ingestion job tracking

**Choice**: Add `IngestionJob` TypeORM entity/table and persist one row before enqueue.
**Alternatives considered**: BullMQ-only job inspection; derive status from worker logs.
**Rationale**: BullMQ IDs are operational, not durable domain audit records. DB rows support deterministic status/counts, future API inspection, and stable rollback.

### Decision: Emit events from worker, not controller

**Choice**: Publish `NewProcurementNoticeEvent` only after worker chunk upsert succeeds.
**Alternatives considered**: Emit on HTTP accept; emit inside current controller/service.
**Rationale**: Actual persistence happens in `ProcurementIngestionWorker`. Earlier emission would lie about durable writes.

### Decision: English route/event naming with compatibility aliases

**Choice**: Keep canonical English surface: `procurement-notices`, `NewProcurementNoticeEvent`, `ScoringDispatchJob`. Preserve existing `/bulk-ingest` + `/bulk` aliases on same English controller.
**Alternatives considered**: Add Spanish route/event names.
**Rationale**: Matches active module names, avoids naming drift, preserves current clients without bifurcating domain language.

### Decision: Explicit dual TypeORM registration

**Choice**: Register `IngestionJob` in both `apps/nest/src/config/typeorm.options.ts` and `apps/nest/src/data-source.ts`.
**Alternatives considered**: Rely on runtime-only registration; enable `synchronize`.
**Rationale**: Project policy forbids `synchronize`; migration CLI and runtime must see same entities.

## Data Flow

```text
POST /procurement-notices/bulk
        │
        ▼
ProcurementIngestionService
  1. create ingestion_jobs row (ACCEPTED/PENDING)
  2. enqueue BullMQ payload { ingestionJobId, records }
        │
        ▼
ProcurementIngestionWorker
  3. mark PROCESSING
  4. dedupe + chunk + upsert notices
  5. update created/updated/failed counters
  6. refetch affected notices by secopId
  7. emit NewProcurementNoticeEvent per persisted notice
        │
        ├──► Scoring dispatch listener → scoring queue job
        └──► ingestion_jobs row → COMPLETED / PARTIAL / FAILED
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/nest/src/modules/procurement-notices/entities/ingestion-job.entity.ts` | Create | DB-backed ingestion job aggregate |
| `apps/nest/src/modules/procurement-notices/procurement-notices.module.ts` | Modify | register/export `IngestionJob` dependencies |
| `apps/nest/src/modules/procurement-notices/services/ingestion.service.ts` | Modify | create `IngestionJob`, enqueue payload with tracking ID |
| `apps/nest/src/modules/procurement-notices/controllers/procurement-notices.controller.ts` | Modify | keep English bulk aliases, return tracked job ID |
| `apps/nest/src/modules/procurement-notices/entities/procurement-notice.entity.ts` | Modify | add `rawData` JSONB if spec confirms distinct raw payload |
| `apps/nest/src/modules/procurement-notices/events/new-procurement-notice.event.ts` | Create | typed domain event payload |
| `apps/nest/src/modules/queues/producers/procurement-ingestion.producer.ts` | Modify | include `ingestionJobId` in payload contract |
| `apps/nest/src/modules/queues/workers/procurement-ingestion.worker.ts` | Modify | update job lifecycle, emit events, persist counts |
| `apps/nest/src/modules/queues/producers/scoring-dispatch.producer.ts` | Create | typed scoring enqueue boundary |
| `apps/nest/src/modules/scoring/scoring.module.ts` | Modify | host scoring dispatch listener/provider |
| `apps/nest/src/config/typeorm.options.ts` | Modify | runtime entity registration |
| `apps/nest/src/data-source.ts` | Modify | CLI/migration entity registration |
| `apps/nest/src/migrations/<timestamp>-IngestionJobsAndRawData.ts` | Create | schema for `ingestion_jobs` and optional `raw_data` |

## Interfaces / Contracts

```ts
type IngestionJobStatus = 'ACCEPTED' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

interface ProcurementIngestionJobData {
  ingestionJobId: string;
  records: CreateProcurementNoticeDto[];
}

interface NewProcurementNoticeEvent {
  ingestionJobId: string;
  procurementNoticeId: string;
  secopId: string;
  action: 'created' | 'updated';
}

interface ScoringDispatchJobData {
  procurementNoticeId: string;
  secopId: string;
  sourceEvent: 'NewProcurementNoticeEvent';
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `ProcurementIngestionService` job-row creation and enqueue payload | constructor-injected mocks |
| Unit | `ProcurementIngestionWorker` status transitions, counters, event emission, scoring dispatch | mock repositories + emitter/producer |
| Integration | queue module wiring with `IngestionJob` + `ProcurementNotice` repositories | Nest testing module overrides |
| Integration | dual registration coverage | extend `typeorm.options.spec.ts` / datasource assertions |
| E2E-lite | controller returns tracked job id from English bulk routes | controller spec with service mocks |

## Migration / Rollout

Single migration adds `ingestion_jobs` table plus optional `procurement_notices.raw_data` column. Rollout order: migration first, runtime registrations second, worker/controller changes third. No feature flag required because endpoint already exists and response shape remains `jobId`.

## Open Questions

- [ ] Should `rawData` be distinct from `sourceMetadata`? Preferred: distinct column for audit fidelity.
- [ ] Should `NewProcurementNoticeEvent` fire for updates and creates, or creates only? Preferred: both, with explicit `action`.

# Proposal: ANC-68 Bulk Ingestion Completion

## Intent

Close ANC-68 ingestion gaps without duplicating ANC-67. Keep English `procurement-notices` ingestion as core.

## Scope

### In Scope
- Persist `ingestion_jobs` for accepted bulk submissions, statuses, and terminal counts.
- Add thin `POST /procurement-notices/bulk` route that forwards to existing bulk pipeline.
- Define raw payload semantics: add `raw_data` JSONB or formally map ANC-68 `raw_data` to existing `source_metadata`.
- Emit `NewProcurementNoticeEvent` after successful notice insert/upsert.
- Dispatch lightweight scoring jobs from ingestion event; no scoring algorithm.

### Out of Scope
- Full Spanish rename of modules/entities.
- SODA/Hermes fetching, scheduler, historical backfill.
- Scoring calculation, ranking, UI.

## Capabilities

### New Capabilities
- `scoring-dispatch`: event-driven enqueue contract for future scoring.

### Modified Capabilities
- `procurement-notices`: raw payload semantics and post-ingest event behavior.
- `hybrid-ingestion`: persistent ingestion job tracking and bulk route.
- `async-job-queues`: scoring job contract and queue visibility.

## Approach

Extend current pipeline: controller validates same DTO, service persists/upserts notices, `IngestionJob` tracks status/counts, event emitter publishes creation/upsert events, scoring producer enqueues dispatch-only jobs. English internals remain source of truth.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/nest/src/modules/procurement-notices` | Modified | bulk route/service/event/raw data |
| `apps/nest/src/modules/queues` | Modified | scoring producer/job contract |
| `apps/nest/src/modules/scoring` | Modified | dispatch boundary only |
| `apps/nest/src/config/typeorm.options.ts` | Modified | register `IngestionJob` runtime entity |
| `apps/nest/src/data-source.ts` | Modified | register `IngestionJob` migration entity |
| `apps/nest/src/migrations` | New | ingestion job/raw data migration |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Naming drift | High | English core, Spanish adapter only |
| `raw_data` ambiguity | Med | Spec decision before implementation |
| Scoring scope creep | Med | Dispatch only, no scoring logic |
| Missed dual TypeORM registration | Med | Explicit tasks/tests |

## Rollback Plan

Revert migration/entity/route/event/scoring-dispatch changes and remove any event dependency added. Existing ANC-67 English bulk ingestion remains intact.

## Dependencies

- Existing OpenSpec specs: `procurement-notices`, `hybrid-ingestion`, `async-job-queues`.
- Optional `@nestjs/event-emitter` only if specs require in-process event emission.

## Success Criteria

- [ ] `POST /procurement-notices/bulk` returns async job id using existing pipeline.
- [ ] Ingestion job state/counts persist deterministically.
- [ ] Raw payload behavior is specified and tested.
- [ ] Insert/upsert emits event and dispatches scoring job per spec.
- [ ] Existing English endpoints/tests remain compatible.

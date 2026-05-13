# Proposal: Hybrid Ingestion Core

## Intent

Turn `ConvocatoriasModule` from placeholder into the first real SECOP domain module and add a bulk ingestion entrypoint that reuses BullMQ. This closes the post-foundation gap: auth, health, DB, and queues exist, but no procurement data can be modeled, searched, or ingested yet.

## Scope

### In Scope
- `Convocatoria` persistence model, migration, DTOs, validation, CRUD/search foundation, pagination/filtering.
- `POST /convocatorias/bulk` to accept normalized SECOP records and enqueue async ingestion work.
- Ingestion worker foundation: deduplication/upsert by stable SECOP identifiers, chunked processing, basic job result reporting.
- Clean module boundaries so future Hermes/SODA automation calls the same application service/queue producer.

### Out of Scope
- Hermes scheduler or any recurring automation service.
- SODA 3.0 HTTP client, real external fetching, app-token handling.
- Sector classification, enrichment, historical 970k backfill, scoring, Companies integration.

## Capabilities

### New Capabilities
- `convocatorias`: CRUD/search behavior and persisted procurement notice model.
- `hybrid-ingestion`: Bulk ingestion API and async processing contract for manual or future automated sources.

### Modified Capabilities
- `async-job-queues`: Add domain-owned procurement ingestion job producer/worker using existing queue infrastructure.

## Approach

Implement Candidate C from exploration. Keep NestJS responsible for domain modeling, validation, ingestion orchestration, and queue processing. External automation remains a caller: later Hermes or a SODA client can submit payloads through the same bulk ingestion boundary instead of bypassing domain logic.

Manual trigger recommendation: **defer `POST /convocatorias/fetch`**. Add it in the next change with a SODA client if “auto” must mean on-demand external fetch. For this change, `POST /convocatorias/bulk` is the correct minimal trigger because it enqueues work without coupling NestJS to scheduler/fetch concerns.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/nest/src/modules/convocatorias/` | Modified | Entity, DTOs, controller, service, ingestion service |
| `apps/nest/src/modules/queues/` | Modified | Procurement ingestion producer/worker registration |
| `apps/nest/src/migrations/` | New | `convocatorias` table and indexes |
| `openspec/specs/` | New/Modified | New domain specs plus queue delta |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| SECOP field mismatch | Med | Normalize DTO contract first; keep raw payload metadata |
| Large batch pressure | Med | Validate max batch size and process chunks async |
| Duplicate records | High | Use stable identifiers + unique constraints + upsert semantics |
| Scope creep into Hermes/SODA | Med | Defer fetch/schedule endpoint explicitly |

## Rollback Plan

Revert module, queue registrations, and migration. If migration ran, create a down migration/drop table before redeploying previous code.

## Dependencies

- Existing TypeORM/Postgres, auth/RBAC, validation, and BullMQ/Redis foundations.
- No external SODA token required in this change.

## Success Criteria

- [ ] Convocatorias can be created, read, updated, deleted, searched, and paginated.
- [ ] Bulk endpoint validates payloads and returns an async job id.
- [ ] Worker deduplicates/upserts records without blocking HTTP requests.
- [ ] Future automation can call the same ingestion boundary.

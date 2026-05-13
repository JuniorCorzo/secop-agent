# Design: Hybrid Ingestion Core

## Technical Approach

Turn `ConvocatoriasModule` into a real domain module with a persisted `Convocatoria` entity, CRUD/search REST surface, and a `POST /convocatorias/bulk` endpoint that enqueues async ingestion through BullMQ. The ingestion worker upserts records by a stable SECOP identifier (`secopId`) in chunked transactions. Future Hermes/SODA callers will reuse the same producer contract.

## Architecture Decisions

| Decision | Options | Tradeoffs | Choice |
|----------|---------|-----------|--------|
| Stable dedup key | `secopId` (string) vs composite keys | `secopId` is the canonical SECOP process number; simple unique constraint, index-friendly | `secopId` with `UNIQUE` index |
| Upsert mechanism | TypeORM `upsert()` vs raw `ON CONFLICT` | `upsert()` is portable and keeps logic in the repository layer; raw SQL is faster but less maintainable | TypeORM `upsert()` with `['secopId']` conflict keys |
| Chunk size | 50 / 100 / 200 records | 50 balances transaction size and worker throughput; easy to tune later | 50 records per chunk |
| Queue job payload | Full batch array vs chunked sub-jobs | Single job with in-worker chunking keeps queue surface minimal and job tracking simple | Single job; worker chunks internally |
| Raw payload storage | `jsonb` column vs separate table | `jsonb` on the same row preserves sync context without joins; SECOP schemas vary | `sourceMetadata: jsonb` on `Convocatoria` |
| Batch size limit | 500 / 1000 / 2000 | 1000 protects DB and queue memory while allowing meaningful bulk loads | Max 1000 records per request |

## Data Flow

```
Client ──POST /convocatorias/bulk──→ ConvocatoriasController
                                           │
                                           ▼
                              ConvocatoriasService (validation)
                                           │
                                           ▼
                        ProcurementIngestionProducer.add(batch)
                                           │
                                           ▼
                                   BullMQ Queue (Redis)
                                           │
                                           ▼
                        ProcurementIngestionWorker.process(job)
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
                chunk 1                chunk 2                chunk N
                    │                      │                      │
                    ▼                      ▼                      ▼
           TypeORM upsert()        TypeORM upsert()       TypeORM upsert()
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `modules/convocatorias/entities/convocatoria.entity.ts` | Create | TypeORM entity with `secopId`, normalized fields, and `sourceMetadata jsonb` |
| `modules/convocatorias/dto/create-convocatoria.dto.ts` | Create | Validation rules for manual create |
| `modules/convocatorias/dto/update-convocatoria.dto.ts` | Create | Partial update DTO |
| `modules/convocatorias/dto/bulk-ingestion.dto.ts` | Create | Batch wrapper with max-size validation |
| `modules/convocatorias/dto/search-convocatoria.dto.ts` | Create | Pagination/filter query DTO |
| `modules/convocatorias/controllers/convocatorias.controller.ts` | Create | CRUD + bulk endpoint; guarded by JWT/RBAC |
| `modules/convocatorias/services/convocatorias.service.ts` | Create | CRUD, search with QueryBuilder, pagination |
| `modules/convocatorias/services/ingestion.service.ts` | Create | Orchestrates bulk validation and producer call |
| `modules/convocatorias/convocatorias.module.ts` | Modify | Wire `TypeOrmModule.forFeature([Convocatoria])`, providers, controllers |
| `modules/queues/producers/procurement-ingestion.producer.ts` | Create | Extends `BaseQueueProducer`; validates `BulkIngestionPayload` |
| `modules/queues/workers/procurement-ingestion.worker.ts` | Create | `@Processor(PROCUREMENT_NOTICE_INGESTION)`; chunks and upserts |
| `modules/queues/queues.module.ts` | Modify | Register procurement queue, provider, worker; export producer |
| `migrations/{ts}-ConvocatoriasTable.ts` | Create | Table, indexes, and `UNIQUE` constraint on `secop_id` |
| `config/typeorm.options.ts` | Modify | Add `Convocatoria` to entities array |
| `data-source.ts` | Modify | Add `Convocatoria` to entities array |

## Interfaces / Contracts

```typescript
// Ingestion job payload (enqueue boundary)
export class BulkIngestionPayload {
  records: ConvocatoriaRecord[];
}

// Worker return contract
export interface IngestionJobResult {
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ secopId: string; reason: string }>;
}
```

- `ConvocatoriasService.search(dto)` returns `{ data: Convocatoria[]; meta: { page, limit, total, totalPages } }`.
- `POST /convocatorias/bulk` returns `{ jobId: string }` immediately; processing is async.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | DTO validation, entity transforms, chunking logic | Jest with isolated classes |
| Integration | Repository upsert, search filters, pagination | `TestingModule` + in-memory SQLite or test Postgres container |
| Integration | Producer enqueue + worker processing | `TestingModule` with BullMQ `Queue` and manual `Worker` trigger |
| E2E | Bulk endpoint → queue → DB outcome | Supertest against running app with Redis/Postgres |

## Migration / Rollout

1. Run migration to create `convocatorias` table and indexes before deploying code.
2. Deploy new module + queue registration.
3. If rollback is needed, stop workers, revert code, and run down migration to drop the table.

## Tradeoffs and Non-Goals

- **No `POST /convocatorias/fetch`**: External fetch and Hermes scheduling are deferred to a later change with SODA integration.
- **No enrichment/scoring**: Sector classification and scoring remain out of scope.
- **Single-queue strategy**: One queue per job type keeps observability simple; we can shard later if throughput demands it.
- **Worker chunking vs sub-jobs**: In-worker chunking avoids queue bloat and keeps job-level reporting trivial, at the cost of slightly longer single-job runtime.

## Open Questions

- None blocking.

# Design: ANC-72 Enrichment Pipeline

## Technical Approach

We will extend the `ProcurementNotice` entity and database table with coordinate and metrics fields. The notice enrichment logic will run inline during the ingestion process inside the sandboxed processor `import-processor.ts`. Since the sandboxed processor runs in a separate worker thread without NestJS DI access, we will implement the enrichment engine as pure functions in a utility file (`enrichment.utils.ts`).

## Architecture Decisions

### Decision: In-line Sandboxed Worker Enrichment

**Choice**: Run enrichment inline inside `import-processor.ts`'s mapping phase (`toEntityShape()`).
**Alternatives considered**: Asynchronous enrichment triggered by `NewProcurementNoticeEvent` via event listener.
**Rationale**: Inline enrichment guarantees that once a notice is written to the database, it is already fully enriched. Downstream consumers (like scoring) can immediately consume coordinates and metrics without waiting for another async queue cycle. This reduces Redis/BullMQ job congestion and aligns with KISS/YAGNI.

### Decision: Static Local Geocoding Lookup

**Choice**: Map Colombian departments to capital/center coordinates using a static local lookup table.
**Alternatives considered**: Integrate an external geocoding API (e.g., Nominatim, Mapbox).
**Rationale**: Ingesting thousands of records from SECOP would quickly exceed rate limits or incur high costs if using an external API. A static local lookup is 100% reliable, fast, has zero external dependencies, and is sufficient for regional/departmental targeting.

### Decision: Pure Function Enrichment Module

**Choice**: Create a pure utility file `apps/nest/src/modules/procurement-notices/utils/enrichment.utils.ts` and import it in `import-processor.ts`.
**Alternatives considered**: Inject an `EnrichmentService` in NestJS.
**Rationale**: The BullMQ sandboxed worker is isolated and does not instantiate the NestJS container. Using pure functions allows sharing the exact same enrichment logic between the sandboxed worker and any NestJS services/controllers (e.g. manual classification endpoints).

## Data Flow

```text
SODA Ingestion / Bulk Upload
        │
        ▼
importProcessor (Sandboxed Worker Thread)
  1. Load records batch
  2. Load sector keywords & enrichment utility
  3. Map records via toEntityShape():
     a. Clean NITs (entityNit, awardedContractorNit)
     b. Clean currency
     c. Resolve latitude/longitude from department
     d. Calculate duration (deadlineDate - publicationDate)
     b. Calculate value_per_day (value / duration)
  4. Save batch to Database via upsert
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/nest/src/modules/procurement-notices/entities/procurement-notice.entity.ts` | Modify | Add `latitude`, `longitude`, `execution_duration_days`, and `value_per_day` fields to the notice entity. |
| `apps/nest/src/modules/procurement-notices/utils/enrichment.utils.ts` | Create | Pure helper functions for NIT cleaning, department mapping, and duration/value metrics calculation. |
| `apps/nest/src/modules/queues/processors/import-processor.ts` | Modify | Call `enrichNotice` utility inside `toEntityShape()` mapping phase. |
| `apps/nest/src/migrations/<timestamp>-AddEnrichmentFields.ts` | Create | DB migration to add coordinates and metrics columns. |

## Interfaces / Contracts

```ts
interface EnrichmentResult {
  latitude: number | null;
  longitude: number | null;
  executionDurationDays: number | null;
  valuePerDay: number | null;
  entityNit: string | null;
  awardedContractorNit: string | null;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|------|--------------|----------|
| Unit Tests | `enrichment.utils.ts` pure behavior | Test NIT cleaning, geocoding lookups, and duration/value division edge cases (e.g. division by zero, null dates). |
| Integration Tests | `import-processor.ts` end-to-end mapping | Mock database interactions and verify `toEntityShape` maps coordinates and metrics correctly. |

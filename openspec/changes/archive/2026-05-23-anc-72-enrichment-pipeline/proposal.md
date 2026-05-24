# Proposal: ANC-72 Enrichment Pipeline

## Intent

Implement a lightweight, fast, and deterministic enrichment pipeline (normalization, geolocation mapping, and metrics calculation) to enhance raw procurement notices data during ingestion and classification.

## Scope

### In Scope
- Add columns to `ProcurementNotice` entity and table:
  - `latitude` (decimal, coordinate of execution department)
  - `longitude` (decimal, coordinate of execution department)
  - `execution_duration_days` (integer, duration between publication and deadline dates)
  - `value_per_day` (decimal, base base value divided by duration)
- Write an `EnrichmentUtility` (pure functions) for:
  - **Normalization**: Clean `entityNit` and `awardedContractorNit` (remove dots, hyphens, and spaces). Standardize/validate currency.
  - **Geolocation**: Map Colombian departments (e.g. "Cundinamarca", "Antioquia", "Valle del Cauca") to their capital/center lat/long coordinates using a static local lookup table.
  - **Metrics**: Compute duration in days between publication and deadline dates. Compute value per day.
- Integrate the enrichment utilities directly into the BullMQ sandboxed worker (`import-processor.ts`) to enrich notices before DB upsert.
- Create TypeORM database migration to add coordinates and metrics columns.

### Out of Scope
- External geocoding API calls (e.g., Google Maps, Nominatim) — lookup must be local and static to ensure speed and prevent rate limits.
- Advanced AI-based text normalization.
- Frontend map components or metric graphs.

## Capabilities

### New Capabilities
- `enrichment-pipeline`: Static geolocator, NIT/field normalizer, and ingestion-time metrics calculator.

### Modified Capabilities
- `procurement-notices`: Schema expansion, database migrations, and sandboxed ingestion processor (`import-processor.ts`) integration.

## Approach

Extend `import-processor.ts` by calling a new `enrichNotice` pure function before saving to the database. Since sandboxed worker threads have no access to NestJS DI, enrichment logic will be written as a pure utility module `procurement-notices/utils/enrichment.utils.ts`. A database migration will add `latitude`, `longitude`, `execution_duration_days`, and `value_per_day` to the `procurement_notices` table.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/nest/src/modules/procurement-notices/entities` | Modified | Add latitude, longitude, execution duration, and value per day columns to `ProcurementNotice` entity. |
| `apps/nest/src/modules/procurement-notices/utils` | New | Create `enrichment.utils.ts` containing pure enrichment functions. |
| `apps/nest/src/modules/queues/processors` | Modified | Integrate enrichment utility in `import-processor.ts` inside `toEntityShape()`. |
| `apps/nest/src/migrations` | New | Database migration adding the 4 new columns. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missing Department Geolocation | Low | Map all 33 Colombian departments in static lookup; fallback to null for unrecognized. |
| Sandboxed worker import failure | Med | Keep utilities pure and importable via path resolver, test imports in worker spec. |
| Empty/Invalid Dates for Metrics | High | If publication or deadline date is missing/invalid, default duration and value-per-day to null. |
| Value division by zero | Low | If duration is 0, default value-per-day to null. |

## Rollback Plan

Revert entity additions and database migration. Rollback sandboxed worker changes in `import-processor.ts`.

## Dependencies

- Existing database migrations and `ProcurementNotice` schema.
- Static lookup table of Colombian departments.

## Success Criteria

- [ ] Database migration successfully adds columns: `latitude`, `longitude`, `execution_duration_days`, `value_per_day`.
- [ ] NIT values are normalized during ingestion (dots, dashes, and spaces removed).
- [ ] Colombian departments are geocoded to correct coordinates.
- [ ] Execution duration and value per day metrics are calculated correctly.
- [ ] Sandboxed ingestion processor runs without worker thread crash and compiles correctly.

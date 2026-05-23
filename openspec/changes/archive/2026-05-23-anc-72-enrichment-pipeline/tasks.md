# Tasks: ANC-72 Enrichment Pipeline

## Phase 1: Database Schema and Entities

- [x] 1.1 Modify `apps/nest/src/modules/procurement-notices/entities/procurement-notice.entity.ts` — Add columns to `ProcurementNotice` entity:
  - `latitude` (type: `decimal`, precision: 10, scale: 6, nullable: true)
  - `longitude` (type: `decimal`, precision: 10, scale: 6, nullable: true)
  - `executionDurationDays` (mapped to `execution_duration_days`, type: `integer`, nullable: true)
  - `valuePerDay` (mapped to `value_per_day`, type: `decimal`, precision: 18, scale: 2, nullable: true)
- [x] 1.2 Generate DB migration — Run `bun run --cwd apps/nest migration:generate -- src/migrations/AddEnrichmentFields` to create schema changes.

## Phase 2: Enrichment Core Utilities

- [x] 2.1 Create `apps/nest/src/modules/procurement-notices/utils/enrichment.utils.ts` containing pure helper functions:
  - `cleanNit(nit: string | null | undefined): string | null`
  - `geocodeDepartment(department: string | null | undefined): { latitude: number | null, longitude: number | null }`
  - `calculateMetrics(pubDate: Date | null, deadlineDate: Date | null, value: number | null): { executionDurationDays: number | null, valuePerDay: number | null }`
  - `enrichNotice(record: any): any` (processes a notice payload applying NIT cleaning, geocoding lookup, and metrics calculation)
- [x] 2.2 Define Colombian departments static mapping coordinates inside `enrichment.utils.ts` (e.g. Bogotá, Antioquia, Valle del Cauca, etc.).

## Phase 3: Sandbox Worker Integration

- [x] 3.1 Modify `apps/nest/src/modules/queues/processors/import-processor.ts` — Import `enrichNotice` from `enrichment.utils.ts` and call it inside `toEntityShape()` mapper.

## Phase 4: Testing

- [x] 4.1 Create `apps/nest/test/enrichment.utils.spec.ts` — Unit test pure functions:
  - Verify `cleanNit` removes dots, dashes, and spaces.
  - Verify `geocodeDepartment` maps known departments (like "Cundinamarca", "Antioquia") to correct coordinates and returns nulls for unknown ones.
  - Verify `calculateMetrics` computes duration in days and value per day correctly, handles null dates gracefully, and avoids division-by-zero errors.
- [x] 4.2 Modify `apps/nest/test/procurement-ingestion.worker.spec.ts` — Add test cases in `toEntityShape` block verifying that coordinates and metrics are mapped on ingestion.

## Phase 5: Verification and Clean-up

- [x] 5.1 Run all tests locally: `bun run --cwd apps/nest test` to ensure there are no regressions.

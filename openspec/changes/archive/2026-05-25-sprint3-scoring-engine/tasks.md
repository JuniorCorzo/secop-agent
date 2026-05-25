## 1. Schema & Database Migrations

- [x] 1.1 Extend `Company` entity in `apps/nest/src/modules/companies/entities/company.entity.ts` with new columns: `targetTicket`, `workingCapital`, `annualRevenue`, `excludedContractTypes`, `excludedModalities`, `unspscMatchPolicy`.
- [x] 1.2 Create `CompanyContract` entity in `apps/nest/src/modules/companies/entities/company-contract.entity.ts` with columns: `description`, `unspscCode`, `value`, `clientNit`, `status`, `startDate`, `endDate`, and many-to-one relationship to `Company`.
- [x] 1.3 Create `MatchingResult` entity in `apps/nest/src/modules/scoring/entities/matching-result.entity.ts` with columns: `status` (`EXCLUDED` / `PASSED`), `score`, `vectorBreakdown` (JSONB), `justification`, and relations to `Company` and `ProcurementNotice`.
- [x] 1.4 Register `CompanyContract` and `MatchingResult` in `typeorm.options.ts` and `data-source.ts`.
- [x] 1.5 Generate TypeORM migration using `bun run --cwd apps/nest migration:generate -- src/migrations/AddScoringAndContracts` and run it.

## 2. Core Match & Scoring Engines

- [x] 2.1 Implement `text-similarity.utils.ts` in `apps/nest/src/modules/scoring/utils/` to handle stop-word filtering, tokenization, TF-IDF representation, and cosine similarity.
- [x] 2.2 Implement `divipola.utils.ts` in `apps/nest/src/modules/scoring/utils/` for cleaning and mapping location names to DIVIPOLA department/municipality codes.
- [x] 2.3 Implement `HardFiltersService` in `apps/nest/src/modules/scoring/services/hard-filters.service.ts` checking financial capacity, residual capacity $K_R$, UNSPSC hierarchies, DIVIPOLA geography, excluded types/modalities, and deadline validity.
- [x] 2.4 Implement `ScoringEngineService` in `apps/nest/src/modules/scoring/services/scoring-engine.service.ts` computing Technical Fit, Economic Fit, Experience Match, and Affinity/Geographical vectors.

## 3. Worker Integration & Ingestion Flow

- [x] 3.1 Implement `ScoringWorker` in `apps/nest/src/modules/scoring/workers/scoring.worker.ts` consuming from the `scoring` queue to process notice-company matching and transition notices to `SCORING`.
- [x] 3.2 Register services, workers, and TypeORM entities in `ScoringModule` and wire it up to `AppModule`.

## 4. Testing & Verification

- [x] 4.1 Create strict TDD unit tests for Hard Filters in `apps/nest/test/hard-filters.spec.ts`.
- [x] 4.2 Create strict TDD unit tests for the Scoring Engine in `apps/nest/test/scoring-engine.spec.ts`.
- [x] 4.3 Run `bun test` and ensure all tests compile and pass successfully.

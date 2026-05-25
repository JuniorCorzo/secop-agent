## 1. Database Configuration and Migration

- [x] 1.1 Create the `ScoreLog` entity class in `apps/nest/src/modules/scoring/entities/score-log.entity.ts` representing the `score_logs` table
- [x] 1.2 Register `ScoreLog` in `apps/nest/src/config/typeorm.options.ts` and `apps/nest/src/data-source.ts`
- [x] 1.3 Generate the TypeORM migration `AddScoreLogsTable` using the command `bun run --cwd apps/nest migration:generate -- src/migrations/AddScoreLogsTable`
- [x] 1.4 Apply the database migration by running `bun run --cwd apps/nest migration:run`

## 2. LLM Provider Layer

- [x] 2.1 Add `ChatOptions`, `ChatResponse`, `ChatMessage` definitions and the `LlmProvider` interface in `apps/nest/src/modules/llm/interfaces/llm-provider.interface.ts`
- [x] 2.2 Implement the `OpenCodeGoProvider` adapter class in `apps/nest/src/modules/llm/providers/opencode-go.provider.ts` integrating standard OpenAI `/v1/chat/completions`, `/v1/embeddings` and `/health` requests using Axios `HttpService`
- [x] 2.3 Wire and export `LlmProvider` using a custom provider token in `LlmModule` (`apps/nest/src/modules/llm/llm.module.ts`) and import `@nestjs/axios` `HttpModule`

## 3. Asynchronous Batch Queue Setup

- [ ] 3.1 Define `company-batch-scoring` job payload validation using class-validator and class-transformer in a new DTO
- [ ] 3.2 Add `CompanyScoringBatchProducer` producer inheriting from `BaseQueueProducer` and register it in `apps/nest/src/modules/queues/queues.module.ts`
- [ ] 3.3 Update `ScoringWorker` in `apps/nest/src/modules/scoring/workers/` to distinguish jobs by name and delegate to the new batch scoring handler

## 4. Scoring Engine & Resilient Logging

- [ ] 4.1 Update `ScoringEngineService` or the scoring runner to categorize scores into `VIABLE`, `REVISAR`, `BAJA_PRIORIDAD`, or `EXCLUIDO`
- [ ] 4.2 Integrate `LlmProvider` into the scoring orchestration service to generate narrative justifications
- [ ] 4.3 Implement error-handling around LLM API calls with timeouts and safe fallbacks to rule-based justifications on failure
- [ ] 4.4 Persist both `MatchingResult` (upserted for latest state) and `ScoreLog` (appended on every run) records inside the scoring evaluation pipeline

## 5. REST Controller Endpoints

- [ ] 5.1 Implement `GET /api/scoring/:companyId/:convId` under `ScoringController` (with `JwtAuthGuard`) to fetch the latest status, category, score, and explanation
- [ ] 5.2 Implement `POST /api/scoring/:companyId/batch` under `ScoringController` (with `JwtAuthGuard`) to accept a list of notice UUIDs and enqueue the batch job
- [ ] 5.3 Verify all input DTO parameter validations and API responses conform to the spec

## 6. Unit & Integration Testing (Strict TDD)

- [x] 6.1 Write unit tests for `OpenCodeGoProvider` using a mocked `HttpService` in `apps/nest/test/llm/opencode-go.provider.spec.ts`
- [ ] 6.2 Write unit tests for scoring engine categorization and resilient fallback logic under `apps/nest/test/scoring/`
- [ ] 6.3 Write integration tests for `ScoringWorker` verifying database persistence of `MatchingResult` and `ScoreLog` during job execution
- [ ] 6.4 Execute all NestJS tests (`bun run --cwd apps/nest test`) and resolve lint errors

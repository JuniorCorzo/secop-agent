## Context

The current `ScoringModule` evaluates notices using `ScoringEngineService` and `HardFiltersService` and writes only the latest outcome to the `MatchingResult` entity. There is no historical audit log of prior evaluation runs. Additionally, the `LlmModule` is an empty placeholder, lacking the implementation to generate natural-language explanations of matching outcomes. 

We need to:
1. Categorize scores into four bands: `VIABLE` (>= 70), `REVISAR` (40-69), `BAJA_PRIORIDAD` (< 40), or `EXCLUIDO` (fails hard filters).
2. Persist all evaluation runs in a new `ScoreLog` entity (table `score_logs`) for traceability.
3. Design and implement a provider-agnostic `LlmProvider` interface and implement the `OpenCodeGoProvider` adapter using standard OpenAI-compatible endpoints.
4. Support asynchronous batch scoring of multiple notices for a single company using a new job type `company-batch-scoring` in the `scoring` queue.
5. Create REST endpoints under `/api/scoring`.

## Goals / Non-Goals

**Goals:**
- Implement a provider-agnostic `LlmProvider` interface and `OpenCodeGoProvider` adapter using `@nestjs/axios` `HttpService`.
- Create a new `ScoreLog` entity/table and register it in both `typeorm.options.ts` and `data-source.ts`.
- Update `ScoringWorker` to handle the new `company-batch-scoring` job type.
- Implement robust error handling (resilience) so that LLM downtime does not break the scoring flow.
- Add REST APIs for retrieval (`GET /api/scoring/:companyId/:convId`) and batch scheduling (`POST /api/scoring/:companyId/batch`).
- Follow TDD conventions for backend testing with offline mocks.

**Non-Goals:**
- Implementing real RAG fetching (the `ragEvidence` field is kept as a JSONB placeholder for future sprints).
- Modifying the existing scoring math or hard-filter validation logic.
- Building frontend components (which is out of scope for this change).

## Decisions

### Decision 1: Separate `ScoreLog` from `MatchingResult`
- **Options**:
  - Option A: Add historical columns/versioning to `MatchingResult`.
  - Option B: Introduce a separate `ScoreLog` entity/table and keep `MatchingResult` as the source of truth for the latest status.
- **Decision**: Option B.
- **Rationale**: `MatchingResult` is queried frequently to show the latest match status for a company-notice pair. An append-only audit trail in `ScoreLog` avoids bloating the `matching_results` table, ensuring high-performance queries for the active state while preserving deep traceability.

### Decision 2: Provider-Agnostic LLM Interface
- **Options**:
  - Option A: Direct HTTP calls to OpenCodeGo microservice inside the scoring logic.
  - Option B: Define a generic `LlmProvider` interface and implement an adapter `OpenCodeGoProvider`.
- **Decision**: Option B.
- **Rationale**: Decoupling the application from the specific LLM API prevents vendor lock-in. If we transition to direct Ollama usage or another LLM cloud provider (e.g., Azure OpenAI, Anthropic), we only need to write a new adapter implementing `LlmProvider`.

### Decision 3: Resilient LLM Degradation
- **Options**:
  - Option A: Throw errors and fail the scoring worker job if the LLM request fails.
  - Option B: Catch exceptions, log warnings, and fall back to the basic rule-based justification for the `explanation` field.
- **Decision**: Option B.
- **Rationale**: LLM APIs are inherently slow and have lower availability than databases. Failing the entire scoring job due to an LLM timeout or error creates a poor user experience. Scoring calculations must succeed and persist, even if the rich narrative explanation is temporarily missing.

### Decision 4: Single Queue with Job Routing
- **Options**:
  - Option A: Create a separate `company-batch-scoring` BullMQ queue.
  - Option B: Reuse the existing `scoring` queue and route based on the job name (`scoring-dispatch` vs `company-batch-scoring`).
- **Decision**: Option B.
- **Rationale**: Both jobs consume the same underlying services and target the same database entities. Reusing the existing `scoring` queue minimizes BullMQ and Redis overhead, leveraging the existing worker instances and simplifying resource management.

## Risks / Trade-offs

- **[Risk] LLM High Latency**: Calls to LLM models can take several seconds, blocking worker threads.
  - *Mitigation*: Configure request timeouts (e.g. 5 seconds) on `HttpService` calls and evaluate them asynchronously.
- **[Risk] Database Growth**: Persisting every evaluation run in `score_logs` will lead to table size inflation.
  - *Mitigation*: Index `company_id` and `convocatoria_id` to keep query execution plans optimal, and design the table schema to support future partition or prune strategies.
- **[Risk] Concurrent Batch Requests**: Running batch scoring on thousands of notices concurrently could overload the server.
  - *Mitigation*: Enforce request validation limits on input size in `ScoringBatchDto` (e.g. max 100 notices per batch) and throttle endpoints if necessary.

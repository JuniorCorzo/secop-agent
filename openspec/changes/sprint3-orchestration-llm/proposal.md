## Why

Currently, our scoring engine evaluates and saves only the latest match outcome (`MatchingResult`). There is no history or audit trail of prior evaluations, and scores are not categorized. Additionally, we lack a provider-agnostic LLM integration to generate narrative justifications for matches and exclusions, and our BullMQ worker only supports dispatching a single notice to all companies, rather than batch-scoring a single company against multiple notices. This change introduces scoring categorization, a persistent audit log (`score_logs`), a clean LLM provider abstraction (with an OpenCodeGo adapter), and a new batch scoring queue capability to support efficient, traceable batch evaluations.

## What Changes

- **Scoring Categorization & Traceability**:
  - Scores will be categorized as `VIABLE` (>= 70), `REVISAR` (40-69), `BAJA_PRIORIDAD` (< 40), or `EXCLUIDO` (if hard filters fail).
  - A database-backed audit log (`score_logs` table) will capture every scoring run, persisting the score, category, breakdown, RAG evidence, filter details, LLM explanation, and model version.
- **LLM Provider Abstraction Layer**:
  - A clean `LlmProvider` interface and an `OpenCodeGoProvider` adapter implementing OpenAI-compatible/Ollama endpoints.
  - Safe degradation of scoring when LLM requests fail (calculations will not block on LLM failures).
- **Asynchronous Batch Scoring**:
  - A new BullMQ job type `company-batch-scoring` inside the `scoring` queue to process batch evaluation of multiple notices for a single company.
  - A new REST API endpoint to trigger batch scoring and retrieve scoring/log history.

## Capabilities

### New Capabilities
- `llm-provider`: Provider-agnostic LLM interface and OpenCodeGo adapter for OpenAI-compatible/Ollama REST calls, with resilient error handling.
- `company-batch-scoring`: REST endpoint and asynchronous BullMQ job to score a company against a list of notices.

### Modified Capabilities
- `matching-audit-log`: Extend matching result definitions to support score categories and log every single evaluation run to a separate persistent table (`score_logs`).

## Impact

- **API Endpoints**:
  - `GET /api/scoring/:companyId/:convId` (retrieves scoring summary and history logs)
  - `POST /api/scoring/:companyId/batch` (starts batch scoring asynchronously)
- **Database**:
  - New `score_logs` table (foreign keys to `companies` and `procurement_notices`).
- **Dependencies**:
  - `@nestjs/axios` added to `apps/nest` for HTTP integrations.
- **Queues**:
  - `scoring` BullMQ queue updated to handle the new `company-batch-scoring` job type.

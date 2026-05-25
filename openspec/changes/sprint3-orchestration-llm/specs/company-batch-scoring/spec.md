## ADDED Requirements

### Requirement: Batch Scoring REST API Endpoint
The system SHALL expose an authenticated HTTP POST endpoint at `/api/scoring/:companyId/batch` to trigger evaluations for a specific company against a list of notices.

#### Scenario: Dispatch Batch Scoring Request Successfully
- **WHEN** an authenticated user issues a POST to `/api/scoring/:companyId/batch` with a valid JSON payload containing an array of notice UUIDs
- **THEN** the system SHALL validate the input, enqueue a `company-batch-scoring` job into the scoring queue
- **AND** return a `202 Accepted` status with the enqueued job ID

#### Scenario: Fail Invalid Batch Scoring Request
- **WHEN** a POST request to `/api/scoring/:companyId/batch` contains empty or invalid notice UUIDs
- **THEN** the system SHALL reject the request with a `400 Bad Request` validation error

### Requirement: Company Batch Scoring Job Worker
The system SHALL support processing `company-batch-scoring` job types inside the asynchronous `ScoringWorker`.

#### Scenario: Process Batch Job in Scoring Worker
- **WHEN** a `company-batch-scoring` job is consumed by `ScoringWorker`
- **THEN** the system SHALL iterate through the list of notice IDs
- **AND** for each notice: evaluate hard filters and affinity scores, upsert the latest `MatchingResult`, and append a new `ScoreLog` entry

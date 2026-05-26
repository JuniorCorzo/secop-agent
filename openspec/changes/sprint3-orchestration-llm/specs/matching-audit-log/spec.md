## ADDED Requirements

### Requirement: Score Log Historical Traceability
The system SHALL persist a historical audit record in `ScoreLog` for every single evaluation run, retaining the detailed scoring breakdown, category, RAG evidence, filter details, LLM explanation, and model version.

#### Scenario: Log Completed Evaluation Run
- **WHEN** a company evaluation is executed
- **THEN** the system SHALL create and persist a new `ScoreLog` record in the database
- **AND** existing evaluations for the same company and notice SHALL not be overwritten in `ScoreLog`

### Requirement: Scoring Results Retrieval API
The system SHALL expose an authenticated HTTP GET endpoint at `/api/scoring/:companyId/:convId` to retrieve the latest matching result and explanation.

#### Scenario: Successfully Retrieve Scoring Results
- **WHEN** an authenticated user issues a GET request to `/api/scoring/:companyId/:convId`
- **THEN** the system SHALL return a `200 OK` response with the latest `MatchingResult` details, including the score, category, and LLM-generated explanation

## MODIFIED Requirements

### Requirement: Matching Result Persistence
The system SHALL persist evaluations in a `MatchingResult` record, storing the evaluation status (EXCLUDED or PASSED), final score, vector breakdown scores, and execution metadata.

#### Scenario: Save evaluation result of an eligible notice
- **WHEN** a notice evaluation completes successfully and passes all hard filters
- **THEN** the system SHALL create and save a `MatchingResult` record with status `PASSED`, final score, and detailed vector breakdown
- **AND** determine the scoring category based on the total score: `VIABLE` for score >= 70, `REVISAR` for score 40-69, or `BAJA_PRIORIDAD` for score < 40

### Requirement: Narrative Justification Generation
The system SHALL generate a natural-language narrative explanation of the matching outcome. For exclusions, it must explain which hard filter failed. For matches, it must highlight key scoring factors and potential risk alerts.

#### Scenario: Generate narrative justification for excluded notice
- **WHEN** an evaluation is marked as `EXCLUDED` due to a budget mismatch
- **THEN** the system SHALL generate a narrative stating that the notice budget exceeds the company's maximum contracting capacity
- **AND** fall back to standard rule-based explanations if LLM API is unavailable

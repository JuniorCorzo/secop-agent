# matching-audit-log Specification

## Purpose
TBD - created by archiving change sprint3-scoring-engine. Update Purpose after archive.
## Requirements
### Requirement: Matching Result Persistence
The system SHALL persist evaluations in a `MatchingResult` record, storing the evaluation status (EXCLUDED or PASSED), final score, vector breakdown scores, and execution metadata.

#### Scenario: Save evaluation result of an eligible notice
- **WHEN** a notice evaluation completes successfully and passes all hard filters
- **THEN** the system SHALL create and save a `MatchingResult` record with status `PASSED`, final score, and detailed vector breakdown

### Requirement: Narrative Justification Generation
The system SHALL generate a natural-language narrative explanation of the matching outcome. For exclusions, it must explain which hard filter failed. For matches, it must highlight key scoring factors and potential risk alerts.

#### Scenario: Generate narrative justification for excluded notice
- **WHEN** an evaluation is marked as `EXCLUDED` due to a budget mismatch
- **THEN** the system SHALL generate a narrative stating that the notice budget exceeds the company's maximum contracting capacity


# scoring-dispatch Specification

## Purpose
TBD - created by archiving change anc-68. Update Purpose after archive.
## Requirements
### Requirement: Dispatch-only Scoring Boundary

The system MUST translate `NewProcurementNoticeEvent` into asynchronous scoring dispatch and MUST NOT perform scoring calculation inside the ingestion flow.

#### Scenario: Successful notice event triggers dispatch
- GIVEN `NewProcurementNoticeEvent` is emitted for a persisted notice
- WHEN scoring dispatch handles that event
- THEN the system schedules asynchronous scoring work for that notice
- AND HTTP ingestion completion remains independent from scoring runtime

#### Scenario: No success event means no dispatch
- GIVEN notice persistence did not succeed
- WHEN no `NewProcurementNoticeEvent` exists for that attempt
- THEN the system schedules no scoring dispatch work

### Requirement: Per-notice Dispatch Targeting

The system MUST enqueue at most one scoring-dispatch job per successfully persisted notice within a single ingestion attempt, and each job SHALL identify its target `ProcurementNotice` for downstream scoring modules.

#### Scenario: Batch persistence schedules one dispatch per persisted notice
- GIVEN an ingestion attempt persists multiple notices successfully
- WHEN scoring dispatch jobs are enqueued
- THEN each persisted notice receives one dispatch job for that attempt

#### Scenario: Rejected record schedules no dispatch job
- GIVEN one record in an ingestion attempt is rejected before persistence
- WHEN dispatch decisions are made
- THEN no scoring-dispatch job is created for that rejected record


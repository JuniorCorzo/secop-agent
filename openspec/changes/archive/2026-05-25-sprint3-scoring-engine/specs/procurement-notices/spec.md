## MODIFIED Requirements

### Requirement: Lifecycle Progression

The system MUST track `ProcurementNotice` lifecycle progression from `PENDING` through enrichment or scoring stages to terminal business decisions.

#### Scenario: Advance lifecycle state
- **GIVEN** a persisted `ProcurementNotice` in non-terminal state
- **WHEN** valid lifecycle transition is requested
- **THEN** system persists new lifecycle state
- **AND** later reads return updated lifecycle value

#### Scenario: Notice transitions to scoring stage
- **GIVEN** a persisted `ProcurementNotice` in `ENRICHED` state
- **WHEN** a matching scoring job is dispatched for that notice
- **THEN** the system SHALL transition the notice state to `SCORING`

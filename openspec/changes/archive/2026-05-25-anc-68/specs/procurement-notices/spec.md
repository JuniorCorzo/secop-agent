# Delta for procurement-notices

## ADDED Requirements

### Requirement: Raw Payload Preservation

The system MUST retain an opaque raw payload for every notice accepted through ingestion as the canonical upstream audit copy. This raw payload SHALL survive both first insert and later upsert of the same stable SECOP identifier.

#### Scenario: New ingested notice keeps raw payload
- GIVEN a valid ingested notice is accepted for persistence
- WHEN the notice is inserted
- THEN the persisted notice retains its original upstream raw payload
- AND the raw payload remains associated with the stable SECOP identifier

#### Scenario: Repeated notice keeps latest accepted raw payload semantics
- GIVEN an existing notice is matched by stable SECOP identifier during ingestion
- WHEN the notice is upserted successfully
- THEN the persisted notice still has raw payload traceability for that ingestion outcome

### Requirement: Procurement Notice Ingestion Event Emission

The system MUST emit `NewProcurementNoticeEvent` after an ingestion insert or upsert succeeds for a `ProcurementNotice`. The event SHALL be emitted only after persistence succeeds and SHALL identify the persisted notice for downstream consumers.

#### Scenario: Successful insert emits notice event
- GIVEN a valid ingested notice is persisted successfully
- WHEN persistence completes
- THEN the system emits `NewProcurementNoticeEvent`
- AND downstream consumers can identify the persisted notice from that event

#### Scenario: Failed persistence emits no notice event
- GIVEN an ingested notice fails before persistence succeeds
- WHEN ingestion handles the failure
- THEN `NewProcurementNoticeEvent` is not emitted

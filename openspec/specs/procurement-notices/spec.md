# procurement-notices Specification

## Purpose

Provide first persisted SECOP procurement notice capability so authorized clients can create, read, update, delete, and search `ProcurementNotice` records through a stable domain boundary, with support for duplicate-safe bulk ingestion and lifecycle progression tracking.

## Non-Goals

- External SECOP fetching, Hermes scheduling, and `POST /procurement-notices/fetch` are deferred.
- Enrichment, scoring, sector classification, and mass historical backfill are out of scope.
- Frontend UI changes.

## Constraints

- The model MUST preserve a stable SECOP identifier for deduplication.
- Search MUST support pagination and filterable retrieval without requiring background ingestion.
- Bulk ingest MUST handle duplicates and invalid rows deterministically without corrupting stored data.
## Requirements
### Requirement: Persisted Procurement Notice Record

The system MUST persist normalized `ProcurementNotice` records with stable SECOP identifiers, source metadata, and lifecycle state needed for deduplication and later analysis.

#### Scenario: Create procurement notice manually
- **GIVEN** an authorized client sends valid `ProcurementNotice` input
- **WHEN** create operation is submitted
- **THEN** system stores notice with stable SECOP identifier and lifecycle state
- **AND** response returns persisted resource identifier

#### Scenario: Reject duplicate stable identifier outside bulk ingest
- **GIVEN** a `ProcurementNotice` already exists for stable SECOP identifier
- **WHEN** another create operation uses same identifier outside duplicate-safe ingest flow
- **THEN** system rejects duplicate persistence with deterministic error outcome

### Requirement: Validated CRUD and Query Access

The system MUST expose validated create, read, update, and list behavior for `ProcurementNotice` records, including filterable search and pagination metadata.

#### Scenario: List procurement notices with filters
- **GIVEN** persisted `ProcurementNotice` records exist
- **WHEN** authorized client queries with supported filters, text search, ordering, and pagination inputs
- **THEN** system returns matching records for requested page
- **AND** response includes consistent pagination metadata

#### Scenario: Unknown procurement notice
- **GIVEN** no `ProcurementNotice` matches requested resource
- **WHEN** authorized client reads or updates that resource
- **THEN** system returns not-found outcome

### Requirement: Duplicate-safe Bulk Ingest

The system MUST ingest procurement notice batches deterministically, preventing duplicate persisted notices and reporting invalid rows without corrupting stored data.

#### Scenario: Batch ingest with duplicate and invalid rows
- **GIVEN** batch payload contains new rows, duplicate identifiers, and invalid rows
- **WHEN** ingest operation is submitted
- **THEN** system persists only valid non-duplicate notices
- **AND** response reports duplicate and invalid row outcomes deterministically

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

### Requirement: Enriched Fields Persistence

The system MUST store coordinates (`latitude`, `longitude`) and ingestion metrics (`execution_duration_days`, `value_per_day`) as part of the `ProcurementNotice` database table schema.

#### Scenario: Persist enriched notice fields
- GIVEN a raw notice processed by the ingestion engine
- WHEN the notice is successfully saved
- THEN the DB record includes the resolved coordinates and calculated metrics

### Requirement: Sandboxed Ingestion Integration

The sandboxed import processor MUST run notice enrichment inline before performing the database upsert chunk.

#### Scenario: Ingested batch is automatically enriched
- GIVEN a batch of raw records is submitted to the sandboxed processor
- WHEN the processor runs
- THEN every record in the batch is normalized, geolocated, and has metrics computed prior to DB insertion

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


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
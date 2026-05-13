# convocatorias Specification

## Purpose

Provide first persisted SECOP procurement notice capability so authorized clients can create, read, update, delete, and search `Convocatoria` records through a stable domain boundary.

## Non-Goals

- External SECOP fetching, Hermes scheduling, and `POST /convocatorias/fetch` are deferred.
- Enrichment, scoring, sector classification, and mass historical backfill are out of scope.

## Constraints

- The model MUST preserve a stable SECOP identifier for deduplication.
- Search MUST support pagination and filterable retrieval without requiring background ingestion.

## Requirements

### Requirement: Persisted Convocatoria Record

The system MUST persist normalized `Convocatoria` records with a stable SECOP identifier and enough source metadata to support later synchronization.

#### Scenario: Create convocatoria manually

- GIVEN an authorized client sends a valid `Convocatoria`
- WHEN the create operation is submitted
- THEN the system stores the record with its stable SECOP identifier
- AND the response returns the persisted resource identifier

#### Scenario: Duplicate stable identifier

- GIVEN a `Convocatoria` already exists for a stable SECOP identifier
- WHEN another create operation uses the same identifier outside ingestion upsert flow
- THEN the system MUST prevent duplicate persisted notices

### Requirement: CRUD Access

The system MUST allow authorized clients to create, read, update, and delete individual `Convocatoria` records.

#### Scenario: Read and update existing convocatoria

- GIVEN a persisted `Convocatoria`
- WHEN an authorized client requests and updates it
- THEN the system returns current data and persists valid changes

#### Scenario: Unknown convocatoria

- GIVEN no `Convocatoria` matches requested resource
- WHEN an authorized client reads, updates, or deletes it
- THEN the system returns a not-found outcome

### Requirement: Search and Pagination

The system MUST provide paginated search over `Convocatoria` records with filterable retrieval for procurement workflows.

#### Scenario: Search with filters

- GIVEN persisted `Convocatoria` records exist
- WHEN an authorized client searches with supported filters and pagination inputs
- THEN the system returns matching records for requested page
- AND includes pagination metadata

#### Scenario: Empty result page

- GIVEN no records match supplied filters
- WHEN search is requested
- THEN the system returns an empty result set with consistent pagination structure

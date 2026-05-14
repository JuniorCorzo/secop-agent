## MODIFIED Requirements

### Requirement: Persisted Procurement Notice Record
The system MUST persist normalized `ProcurementNotice` records with a stable SECOP identifier and enough source metadata to support later synchronization.

(Previously: requirement used `Convocatoria` naming for same persisted notice behavior.)

#### Scenario: Create procurement notice manually
- **GIVEN** an authorized client sends a valid `ProcurementNotice`
- **WHEN** the create operation is submitted
- **THEN** the system stores record with its stable SECOP identifier
- **AND** response returns persisted resource identifier

#### Scenario: Duplicate stable identifier
- **GIVEN** a `ProcurementNotice` already exists for a stable SECOP identifier
- **WHEN** another create operation uses same identifier outside ingestion upsert flow
- **THEN** system MUST prevent duplicate persisted notices

### Requirement: CRUD Access
The system MUST allow authorized clients to create, read, update, and delete individual `ProcurementNotice` records.

(Previously: CRUD requirement referred to individual `Convocatoria` records.)

#### Scenario: Read and update existing procurement notice
- **GIVEN** a persisted `ProcurementNotice`
- **WHEN** an authorized client requests and updates it
- **THEN** system returns current data and persists valid changes

#### Scenario: Unknown procurement notice
- **GIVEN** no `ProcurementNotice` matches requested resource
- **WHEN** an authorized client reads, updates, or deletes it
- **THEN** system returns not-found outcome

### Requirement: Search and Pagination
The system MUST provide paginated search over `ProcurementNotice` records with filterable retrieval for procurement workflows.

(Previously: search requirement used `Convocatoria` terminology.)

#### Scenario: Search with filters
- **GIVEN** persisted `ProcurementNotice` records exist
- **WHEN** an authorized client searches with supported filters and pagination inputs
- **THEN** system returns matching records for requested page
- **AND** includes pagination metadata

#### Scenario: Empty result page
- **GIVEN** no records match supplied filters
- **WHEN** search is requested
- **THEN** system returns empty result set with consistent pagination structure

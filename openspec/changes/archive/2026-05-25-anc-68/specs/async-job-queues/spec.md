# Delta for async-job-queues

## MODIFIED Requirements

### Requirement: Procurement Ingestion Queue Contract

The system MUST provide a domain-owned procurement ingestion producer and worker pair that uses shared BullMQ infrastructure for `ProcurementNotice` ingestion jobs.
(Previously: Contract targeted `Convocatoria` ingestion jobs and `/convocatorias/bulk`.)

#### Scenario: Domain module enqueues procurement ingestion
- GIVEN shared queue infrastructure is available
- WHEN `POST /procurement-notices/bulk` accepts a valid batch
- THEN the domain submits a named procurement ingestion job to shared queue infrastructure
- AND the caller receives a job identifier without waiting for worker completion

#### Scenario: Queue contract remains domain-owned
- GIVEN future Hermes or SODA automation is added later
- WHEN those callers need ingestion
- THEN they submit through the same procurement ingestion producer contract
- AND they do not bypass domain validation rules

## ADDED Requirements

### Requirement: Scoring Dispatch Queue Contract

The system MUST expose a named scoring-dispatch enqueue contract for successfully persisted procurement notices. Accepted scoring-dispatch jobs SHALL remain visible through existing per-queue operational counts, and enqueue payloads MUST carry dispatch context only.

#### Scenario: Enqueue scoring dispatch after successful persistence
- GIVEN a procurement notice was persisted successfully through ingestion
- WHEN downstream dispatch is requested
- THEN the system enqueues a scoring-dispatch job
- AND operators can observe that queue through existing queue visibility surfaces

#### Scenario: Reject invalid scoring dispatch payload
- GIVEN the scoring-dispatch contract is defined
- WHEN a module submits payload that violates that contract
- THEN the job is rejected before worker execution
- AND no scoring side effects occur

# Delta for async-job-queues

## ADDED Requirements

### Requirement: Procurement Ingestion Queue Contract

The system MUST provide a domain-owned procurement ingestion producer and worker pair that uses shared BullMQ infrastructure for `Convocatoria` ingestion jobs.

#### Scenario: Domain module enqueues procurement ingestion

- GIVEN shared queue infrastructure is available
- WHEN `POST /convocatorias/bulk` accepts a valid batch
- THEN the domain submits a named procurement ingestion job to shared queue infrastructure
- AND the caller receives a job identifier without waiting for worker completion

#### Scenario: Queue contract remains domain-owned

- GIVEN future Hermes or SODA automation is added later
- WHEN those callers need ingestion
- THEN they submit through same procurement ingestion producer contract
- AND they do not bypass domain validation rules

### Requirement: Chunked Procurement Worker Execution

The system MUST process procurement ingestion jobs asynchronously in chunks so large accepted batches do not block HTTP execution and duplicate records can be reconciled safely.

#### Scenario: Large accepted batch

- GIVEN a valid bulk request contains many normalized notices within configured limit
- WHEN the procurement ingestion worker starts processing
- THEN the worker executes asynchronously in chunks
- AND HTTP request completion is independent from worker runtime

#### Scenario: Failed record within job

- GIVEN a procurement ingestion job contains at least one invalid or conflicting record at processing time
- WHEN worker finishes retries for affected work
- THEN the failure is observable in job outcome
- AND unaffected records can still complete under same job

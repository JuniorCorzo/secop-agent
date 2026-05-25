# hybrid-ingestion Specification

## Purpose

Provide a bulk ingestion boundary that accepts normalized SECOP notice payloads, validates them, and starts asynchronous processing through shared queue infrastructure. The automatic ingestion path is handled by the internal NestJS SODA scheduler — this spec covers the manual/external bulk submission contract.

## Non-Goals

- Scheduler-driven automation is covered by the `soda-scheduler` spec.
- AI-based normalization or enrichment is out of scope for ingestion.
- External agents (Hermes) are not part of the ingestion path.

## Constraints

- Bulk ingestion MUST return quickly with async job tracking instead of blocking on record processing.
- Batch size limits and payload validation MUST protect worker and database capacity.
- The automatic scheduler path MUST call `bulkUpsert()` directly without going through the HTTP endpoint.
## Requirements
### Requirement: Bulk Submission Contract

The system MUST expose `POST /procurement-notices/bulk` for authorized clients to submit normalized `ProcurementNotice` batches and receive a persistent asynchronous ingestion job identifier. Accepted requests SHALL forward into the existing bulk ingestion pipeline rather than create a second ingestion path.
(Previously: Exposed `POST /convocatorias/bulk` for async batch submission.)

#### Scenario: Valid bulk submission
- GIVEN an authorized client sends a valid normalized batch
- WHEN `POST /procurement-notices/bulk` is called
- THEN the system accepts the batch for asynchronous ingestion
- AND returns a persisted ingestion job identifier

#### Scenario: Invalid bulk submission
- GIVEN a client sends malformed records or exceeds allowed batch constraints
- WHEN `POST /procurement-notices/bulk` is called
- THEN the system rejects the request before enqueueing work
- AND no ingestion side effects occur

### Requirement: Idempotent Ingestion Outcome

The system MUST process bulk ingestion with upsert semantics based on stable SECOP identifiers so repeated submissions do not create duplicates.

#### Scenario: Repeated batch content

- GIVEN a previously ingested notice appears again in a later batch
- WHEN asynchronous ingestion processes that record
- THEN the system updates or preserves the existing notice instead of duplicating it

#### Scenario: Mixed new and existing records

- GIVEN a batch contains both unseen and previously ingested notices
- WHEN the job completes
- THEN the system persists new notices and upserts existing ones in same logical ingestion run

### Requirement: Basic Job Result Reporting

The system MUST persist an ingestion job for every accepted bulk submission, track non-terminal and terminal job status, and expose deterministic counts sufficient to distinguish created, updated, and failed records at job level.
(Previously: Terminal outcomes were inspectable with summary counts only.)

#### Scenario: Accepted request creates tracked ingestion job
- GIVEN a valid bulk request is accepted
- WHEN asynchronous processing is scheduled
- THEN a persistent ingestion job exists before terminal completion
- AND later inspection can distinguish that the job is still in progress

#### Scenario: Completed job summary
- GIVEN an ingestion job reaches terminal completion
- WHEN job results are inspected through supported operational surfaces
- THEN the system exposes deterministic status and summary counts for created, updated, and failed outcomes

#### Scenario: Partial failure in chunked batch
- GIVEN one chunk or record fails during asynchronous ingestion
- WHEN the job reaches terminal state
- THEN the system reports terminal failure or partial-failure status deterministically
- AND successful records from other valid chunks remain observable


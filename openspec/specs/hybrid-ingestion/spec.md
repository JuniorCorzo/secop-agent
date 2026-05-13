# hybrid-ingestion Specification

## Purpose

Provide a bulk ingestion boundary that accepts normalized SECOP notice payloads, validates them, and starts asynchronous processing through shared queue infrastructure.

## Non-Goals

- `POST /convocatorias/fetch` is explicitly deferred to a later change with SODA integration.
- This change does not define scheduler-driven automation or external HTTP fetching.

## Constraints

- Bulk ingestion MUST return quickly with async job tracking instead of blocking on record processing.
- Batch size limits and payload validation MUST protect worker and database capacity.

## Requirements

### Requirement: Bulk Submission Contract

The system MUST expose `POST /convocatorias/bulk` for authorized clients to submit normalized `Convocatoria` batches and receive an asynchronous job identifier.

#### Scenario: Valid bulk submission

- GIVEN an authorized client sends a valid normalized batch
- WHEN `POST /convocatorias/bulk` is called
- THEN the system accepts the batch for asynchronous ingestion
- AND returns a job identifier for later inspection

#### Scenario: Invalid bulk submission

- GIVEN a client sends malformed records or exceeds allowed batch constraints
- WHEN `POST /convocatorias/bulk` is called
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

The system MUST make terminal ingestion outcomes inspectable with counts sufficient to distinguish accepted, updated, and failed records at job level.

#### Scenario: Completed job summary

- GIVEN an ingestion job reaches terminal completion
- WHEN job results are inspected through supported operational surfaces
- THEN the system exposes summary counts for processed outcomes

#### Scenario: Partial failure in chunked batch

- GIVEN one chunk or record fails during asynchronous ingestion
- WHEN the job reaches terminal state
- THEN the system reports failure in job outcome
- AND successful records from other valid chunks remain observable

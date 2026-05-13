# async-job-queues Specification

## Purpose

Provide shared BullMQ/Redis background execution so later procurement notice ingestion, document processing, scoring, alerts, and RAG work can run asynchronously without introducing domain-specific workers yet.

## Requirements

### Requirement: Shared Queue Bootstrap

The system MUST initialize shared BullMQ queue infrastructure from validated Redis configuration during application startup and make registered queue services available to NestJS modules.

#### Scenario: Startup with valid Redis settings

- GIVEN valid Redis environment settings
- WHEN application starts
- THEN shared queue infrastructure is initialized successfully
- AND registered queue services are available for dependency injection

#### Scenario: Queue infrastructure missing from startup

- GIVEN application startup completes
- WHEN a module resolves shared queue services
- THEN the services are present without module-local BullMQ setup

### Requirement: Typed Enqueue Contract

The system MUST expose shared producer interfaces for named jobs with explicit payload contracts, and it MUST reject enqueue requests that do not satisfy the declared contract.

#### Scenario: Enqueue valid infrastructure job

- GIVEN shared queue infrastructure is available
- WHEN a module submits a named job with payload matching its declared contract
- THEN the job is accepted into the target queue
- AND the caller receives an identifier that can be used for later inspection

#### Scenario: Reject invalid job payload

- GIVEN a named job contract is defined
- WHEN a module submits payload that violates that contract
- THEN the job is rejected before worker execution
- AND no domain side effects occur

### Requirement: Infrastructure-Owned Example Worker

The system MUST include at least one infrastructure-owned queue and worker pair that demonstrates enqueue, execution, and completion behavior without depending on procurement notice, scoring, or other domain entities.

#### Scenario: Example job completes successfully

- GIVEN infrastructure-owned example queue is registered
- WHEN a valid example job is enqueued
- THEN a shared worker processes it asynchronously
- AND the job reaches a completed terminal state

#### Scenario: Domain modules remain optional

- GIVEN no procurement notice ingestion or scoring workers exist yet
- WHEN application starts and example queue runs
- THEN shared queue capability still operates
- AND later domain work can reuse same infrastructure

### Requirement: Default Retry and Failure Lifecycle

The system MUST define centralized default retry behavior for shared queues, and failed jobs MUST remain observable as failed after retries are exhausted unless a job explicitly overrides those defaults.

#### Scenario: Shared defaults apply automatically

- GIVEN a job is enqueued without custom retry options
- WHEN worker processing raises a retryable failure
- THEN shared default retry behavior is applied
- AND the job is retried without producer-specific configuration

#### Scenario: Job exhausts retries

- GIVEN a job continues failing through all allowed retry attempts
- WHEN final attempt finishes
- THEN the job is marked failed
- AND failure remains inspectable through operational surfaces

### Requirement: Queue Health and Operational Visibility

The system MUST expose queue infrastructure readiness and per-queue operational counts so operators can detect whether background processing is available before later procurement notice workflows depend on it.

#### Scenario: Healthy queue surface

- GIVEN Redis and shared queue connections are available
- WHEN operational health is requested
- THEN the response reports queue infrastructure as available
- AND includes inspectable per-queue counts for pending and terminal job states

#### Scenario: Degraded queue surface

- GIVEN Redis or shared queue connectivity is unavailable
- WHEN operational health is requested
- THEN the response reports degraded queue availability
- AND consumers can distinguish queue infrastructure failure from unrelated checks

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

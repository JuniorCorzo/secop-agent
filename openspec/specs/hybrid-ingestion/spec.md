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

El sistema MUST exponer `POST /procurement-notices/bulk` para ingestas manuales o externas. La ingesta automática ahora la realiza el scheduler interno de NestJS directamente — no depende de clientes externos como Hermes.

#### Scenario: Ingesta automática interna
- **WHEN** el scheduler interno completa un ciclo de paginación SODA
- **THEN** los registros normalizados se persisten vía `bulkUpsert()` directamente
- **AND** no se usa el endpoint HTTP interno (evita overhead de red innecesario)

#### Scenario: Ingesta manual vía endpoint
- **WHEN** un cliente autorizado envía un batch normalizado a `POST /procurement-notices/bulk`
- **THEN** el sistema acepta el batch para ingesta asíncrona
- **AND** retorna un job identifier para inspección posterior

#### Scenario: Batch inválido rechazado
- **WHEN** un cliente envía registros malformados o excede los límites del batch
- **THEN** el sistema rechaza el request antes de encolar trabajo
- **AND** no ocurren efectos secundarios de ingesta

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


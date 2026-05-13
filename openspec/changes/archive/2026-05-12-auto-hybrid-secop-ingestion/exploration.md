# Exploration: Sistema de Ingesta Auto + Híbrida desde SECOP

## Current State

The backend foundation is complete after ANC-61 through ANC-65:
- NestJS modular scaffold with 10 domain placeholder modules
- PostgreSQL + pgvector + TypeORM migrations (baseline)
- JWT auth with RBAC (`AuthModule` fully implemented)
- Environment validation + health checks (Postgres, Redis, Hermes, LLM)
- BullMQ/Redis async queue infrastructure (`QueuesModule` with producers, workers, health indicator)

**Critical gap:** All domain modules are still empty placeholders (`ConvocatoriasModule`, `CompaniesModule`, `ScoringModule`, etc.). No entities, DTOs, or business logic exist yet.

**Hermes status:** Only a config placeholder (`hermes.config.ts`) exists. No actual Hermes codebase in the monorepo.

## Linear Roadmap Context

Sprint 1 (Fundación Técnica) — essentially complete:
- ANC-61 ✅ | ANC-62 ✅ | ANC-63 ✅ | ANC-64 ✅ | ANC-65 ✅ (archived)
- ANC-66 (audit/logging interceptors) — backlog, but not blocking

Sprint 2 (Ingesta y Datos) — pending:
- ANC-67: `ConvocatoriasModule` (entity, DTOs, CRUD, search)
- ANC-68: `POST /convocatorias/bulk` endpoint
- ANC-69: `SectorClassifier` (keyword-based sector classification)
- ANC-70: `CompaniesModule` (profile with sectors, regions, capacity)
- ANC-71: Hermes scheduler for SODA 3.0 ingestion
- ANC-72: Enrichment pipeline (normalization, geolocation, metrics)
- ANC-73: Historical backfill (~970k records)

## Interpreting "auto + hibryd"

From the architecture doc (section 66): *"La solución requiere un sistema híbrido: backend estructurado + automatización externa + RAG + scoring determinístico + IA como asistente"*

And from section 19: SODA API 3.0 is the primary automated source, with document downloads and scraping as secondary/fallback sources.

**"auto"** = automated fetching from SECOP/SODA (scheduler/recurring job)
**"hibryd"** = hybrid ingestion system that supports both automated SODA fetching AND manual/bulk ingestion, plus fallback sources

The user likely wants the **Sprint 2 ingestion pipeline**: the system that automatically pulls data from SODA and processes it through the hybrid pipeline (classification, deduplication, enrichment).

## Affected Areas

- `apps/nest/src/modules/convocatorias/` — must graduate from placeholder to full module with entity, DTOs, service, controller
- `apps/nest/src/modules/companies/` — needed for scoring context, but can be deferred if scope is tight
- `apps/nest/src/modules/queues/` — need new queue producers/workers for ingestion jobs
- `apps/nest/src/common/` — may need new pipes/filters for SECOP data normalization
- `apps/nest/src/config/` — need SODA API configuration (URL, app token)
- Database migrations — need domain tables: `convocatorias`, `companies`, `sector_keywords`, `ingestion_jobs`

## Scope Candidates

### Candidate A: ConvocatoriasModule Foundation (ANC-67)
**Scope:** Entity, DTOs, CRUD, search/filters, pagination.
- **Pros:** Prerequisite for every other Sprint 2 task. Unlocks bulk endpoint, scoring, dashboard.
- **Cons:** Does not include "auto" or "hybrid" aspects. User explicitly asked for more than just CRUD.
- **Effort:** Medium (~4-6h)

### Candidate B: Auto-Ingestion Pipeline (ANC-67 + ANC-68 + ANC-69)
**Scope:** ConvocatoriasModule + SODA HTTP client + bulk endpoint + keyword sector classifier + BullMQ ingestion job.
- **Pros:** Directly delivers "auto + hibryd". Enables automatic fetching AND manual bulk upload. Keyword classifier runs in the same pipeline.
- **Cons:** Large scope. Violates the architecture doc's separation of concerns if we put the scheduler inside NestJS (Hermes should handle automation). SODA app token requirement (external dependency).
- **Effort:** High (~12-16h)

### Candidate C: Hybrid Ingestion Core (ANC-67 + ANC-68 only)
**Scope:** ConvocatoriasModule + bulk endpoint + basic deduplication + async BullMQ processing.
- **Pros:** Core "híbrido" — supports both automated (via future Hermes) and manual ingestion. Keeps scheduler external per architecture. Manageable scope.
- **Cons:** No "auto" yet — the automated fetching is not implemented.
- **Effort:** Medium-High (~8-10h)

### Candidate D: SODA Client Module + Manual Trigger (ANC-67 + ANC-68 + SODA client)
**Scope:** ConvocatoriasModule + bulk endpoint + internal SODA HTTP client + manual `POST /convocatorias/fetch` endpoint that triggers a BullMQ job.
- **Pros:** Gives immediate "auto" capability (manual trigger now, cron later). Respects architecture by keeping no cron logic in NestJS — just an on-demand endpoint + queue job.
- **Cons:** Still larger than single-issue scope.
- **Effort:** Medium-High (~10-12h)

## Recommendation

**Recommended: Candidate C (Hybrid Ingestion Core: ANC-67 + ANC-68)** as the primary SDD change, with a follow-up for the SODA client.

**Rationale:**
1. It establishes the domain foundation (`Convocatoria` entity, DTOs, DB schema) which is non-negotiable.
2. It implements the bulk endpoint that Hermes (or any future auto-scheduler) will call.
3. It wires BullMQ for async ingestion processing, leveraging the infrastructure we just built in ANC-65.
4. It respects the architecture doc: NestJS = business logic + ingestion endpoint, automation = external (Hermes or manual trigger).
5. It is "híbrido" because it supports both batch ingestion (from future Hermes) and individual CRUD operations.

After this, a separate change can add the SODA client + manual trigger endpoint, and eventually the Hermes scheduler.

**Alternative:** If the user truly wants "auto" in the same change, expand to Candidate D by adding a `SecopDataSource` service and a manual trigger endpoint.

## Risks

- **SODA app token dependency:** We cannot test real ingestion without a valid `X-App-Token` from datos.gov.co. Need to either mock SODA responses or obtain a token early.
- **Schema mismatch:** SECOP field names are messy (e.g., `fecha_inicio_ejecuci_n`). Mapping to TypeORM entities requires careful normalization.
- **Volume risk:** ~970k historical records. Bulk insert must use TypeORM `save` in chunks or raw SQL COPY.
- **Hermes ambiguity:** No Hermes codebase exists. If the user expects Hermes to be built in this repo, scope explodes.
- **Main branch divergence:** ANC-63/ANC-65 commits exist on `feat/anc-63-auth-jwt-roles` but not on `main`. Any new work should probably branch from `feat/anc-63-auth-jwt-roles` or be preceded by merging to `main`.

## Ready for Proposal?

**Yes — with one clarification needed:**

Does "auto" mean:
1. A manual trigger endpoint that enqueues a SODA-fetch job? (recommended — keeps scope bounded)
2. A full recurring scheduler inside NestJS? (contradicts architecture doc)
3. Building the Hermes automation component? (out of scope for this repo)

If the user confirms option 1, Candidate D is the right scope. If they want just the foundation, Candidate C.

**Next step:** Run `sdd-propose` with the chosen scope.

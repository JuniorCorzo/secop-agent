# Proposal: BullMQ Redis Async Queues

## Intent

Sprint 2 needs durable async execution before ingestion, document processing, scoring, alerts, and LLM/RAG workflows grow beyond request/response APIs. BullMQ/Redis is already installed/configured, so ANC-65 should turn that foundation into a shared queue capability instead of each module inventing ad-hoc background processing.

## Scope

### In Scope
- Wire BullMQ globally to existing Redis config/env validation.
- Add a shared queue module/pattern for producers, workers, queue names, and typed job payloads.
- Provide an initial operational queue example/health surface so future domain modules can enqueue safely.
- Document failure/retry defaults, lifecycle expectations, and module boundaries.

### Out of Scope
- Domain-specific ingestion, scoring, RAG, alerts, or LLM workers.
- Bull Board/admin UI unless later requested.
- Multi-node Redis Cluster/Sentinel or production autoscaling strategy.

## Capabilities

### New Capabilities
- `async-job-queues`: Shared BullMQ/Redis background job infrastructure for enqueueing, processing, retries, and queue health.

### Modified Capabilities
- None.

## Approach

Use NestJS `@nestjs/bull`/BullMQ with `ConfigModule` and existing `redis.config.ts`. Introduce a reusable queues module under `apps/nest/src/modules/queues` or `apps/nest/src/common/queues`, keep domain modules decoupled through typed producer services/constants, and expose minimal health/observability hooks without committing to domain job behavior yet.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/nest/src/app.module.ts` | Modified | Register BullMQ queue infrastructure. |
| `apps/nest/src/config/redis.config.ts` | Modified | Reuse/shape Redis config for BullMQ connection options. |
| `apps/nest/src/modules/health/` | Modified | Include queue/Redis readiness if needed. |
| `apps/nest/src/modules/queues/` | New | Shared queue module, constants, producers/workers pattern. |
| `apps/nest/.env.example` | Modified | Queue-related env documentation if defaults need surfacing. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Queue abstraction too generic or too domain-specific | Med | Keep ANC-65 infrastructure-only, one minimal example, defer domain contracts. |
| Retry/backoff defaults conflict with later workloads | Med | Define conservative defaults and mark workload-specific tuning as follow-up. |
| Worker lifecycle/testing flakiness | Med | Use isolated module tests and avoid external domain side effects. |
| Operational visibility insufficient | Low | Add health/readiness hooks; defer dashboard decision. |

## Rollback Plan

Remove the queue module, BullMQ registration, queue health wiring, and env docs. Existing Redis, auth, persistence, and health checks continue working because Redis config/docker support already exists independently.

## Dependencies

- Existing Redis service in `docker-compose.yml`.
- Existing `redis.config.ts` and env validation from ANC-64.
- Installed `@nestjs/bull` and `bullmq` packages.

## Success Criteria

- [ ] App boots with BullMQ connected to configured Redis.
- [ ] Shared queue module exposes typed enqueue/worker pattern without domain coupling.
- [ ] Queue health/readiness is observable enough for Sprint 2 features.
- [ ] Specs/design/tasks can derive `async-job-queues` from this proposal.

# Design: BullMQ Redis Async Queues

## Technical Approach

Add a shared `QueuesModule` under `apps/nest/src/modules/queues` that registers `BullModule.forRootAsync` with the existing Redis config. The module exports typed producer services and queue-name constants so domain modules (procurement-notice ingestion, scoring, alerts, LLM/RAG) can enqueue jobs without knowing BullMQ internals. Domain modules will own their own workers (`@Processor`) by importing `BullModule.registerQueue()` locally. Health checks will expose queue job counts via the existing health endpoint. No domain-specific job behavior is introduced in ANC-65.

## Architecture Decisions

| Decision | Options | Tradeoffs | Choice |
|----------|---------|-----------|--------|
| NestJS wrapper package | `@nestjs/bull` (legacy Bull) vs `@nestjs/bullmq` (BullMQ) | `@nestjs/bull` peer-depends on `bull`, not `bullmq`. The repo already installs `bullmq`. | **Use `@nestjs/bullmq`** (add dependency, remove `@nestjs/bull` if unused). |
| Module location | `common/queues` vs `modules/queues` | `CommonModule` is global but empty; mixing infrastructure into `common` blurs boundaries. | **`modules/queues`** as a regular shared module imported by `AppModule`. |
| Producer/worker ownership | All in `QueuesModule` vs producers in `QueuesModule`, workers in domain modules | Centralizing workers couples infrastructure to domain logic and creates a monolithic queue module. | **Producers + constants in `QueuesModule`; workers in domain modules** (e.g., `ConvocatoriasModule`). |
| Queue naming | Free-form strings vs centralized constants | Strings drift; hard to refactor. | **Centralized `QUEUE_NAMES` constants** with PascalCase TS enums mapping to kebab-case Bull names. |
| Retry/backoff defaults | Linear vs exponential; aggressive vs conservative | Aggressive retries can overwhelm downstream APIs; linear is predictable but noisy. | **Exponential backoff: 3 attempts, initial delay 2s, max delay 60s, multiplier 2**. Workload-specific tuning deferred. |
| Monitoring/dashboard | Bull Board UI vs health endpoint counts only | Bull Board adds deps and auth surface; full metrics need later design. | **Defer Bull Board**. Expose `waiting/active/completed/failed` counts in `/health` via a queue indicator. |

## Data Flow

```
Domain Service (e.g., ProcurementNoticeService)
         │
         │ injects
         ▼
   Typed Producer (e.g., ProcurementNoticeQueueProducer)
         │
         │ addJob({ payload })
         ▼
      BullMQ Queue (Redis)
         │
         │ picked up by
         ▼
   Domain Worker (@Processor in ConvocatoriasModule)
         │
         │ calls
         ▼
   Domain Services / Repositories
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/nest/package.json` | Modify | Add `@nestjs/bullmq`; remove unused `@nestjs/bull`. |
| `apps/nest/src/modules/queues/queues.module.ts` | Create | Registers `BullModule.forRootAsync` with Redis config; re-exports `BullModule`. |
| `apps/nest/src/modules/queues/constants/queue-names.ts` | Create | Typed queue name constants (e.g., `PROCUREMENT_NOTICE_INGESTION = 'procurement-notice-ingestion'`). |
| `apps/nest/src/modules/queues/interfaces/job-payload.interface.ts` | Create | Base typed payload interface `QueueJob<T>` with `name`, `data`, `opts`. |
| `apps/nest/src/modules/queues/producers/base-queue.producer.ts` | Create | Abstract producer with generic `add(data, opts?)` using injected `Queue`. |
| `apps/nest/src/modules/queues/index.ts` | Create | Barrel export (optional — project currently avoids barrels, so skip if inconsistent). |
| `apps/nest/src/config/redis.config.ts` | Modify | Ensure shape matches `BullModule` `connection` option (host/port/password). Add `db` optional override if needed. |
| `apps/nest/src/app.module.ts` | Modify | Import `QueuesModule`. |
| `apps/nest/src/modules/health/indicators/queue.indicator.ts` | Create | Reads job counts from injected queues; returns `up`/`degraded`. |
| `apps/nest/src/modules/health/health.service.ts` | Modify | Include queue indicator in `check()`. |
| `apps/nest/src/modules/health/health.module.ts` | Modify | Import `BullModule.registerQueue(...)` for queues that need health visibility, or inject `QueuesModule`. |
| `apps/nest/.env.example` | Modify | Document optional `QUEUE_WORKER_CONCURRENCY`, `QUEUE_JOB_TIMEOUT_MS` defaults. |

## Interfaces / Contracts

```typescript
// apps/nest/src/modules/queues/interfaces/job-payload.interface.ts
export interface QueueJob<T> {
  name: string;
  data: T;
  opts?: JobsOptions;
}

// apps/nest/src/modules/queues/constants/queue-names.ts
export const QUEUE_NAMES = {
  PROCUREMENT_NOTICE_INGESTION: 'procurement-notice-ingestion',
  SCORING: 'scoring',
  ALERTS: 'alerts',
  DOCUMENT_PROCESSING: 'document-processing',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
```

Producers expose a minimal contract:

```typescript
export abstract class BaseQueueProducer<T> {
  protected abstract readonly queue: Queue;

  async add(data: T, opts?: JobsOptions): Promise<Job<T>> {
    return this.queue.add(this.jobName, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      ...opts,
    });
  }
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Producer methods, health indicator logic | Jest with mocked `Queue` from `@nestjs/bullmq`. |
| Integration | `QueuesModule` bootstraps without errors, Redis connection healthy | `Test.createTestingModule` + `QueuesModule` + real Redis in docker-compose. |
| E2E | Health endpoint returns queue counts | HTTP call to `/health` after seeding a test job. |

No domain workers exist yet, so worker testing is deferred to downstream changes.

## Migration / Rollout

1. Install `@nestjs/bullmq`. If `@nestjs/bull` is truly unused, remove it.
2. Add `QueuesModule` and constants. No existing code depends on queues yet.
3. Restart app; verify `/health` includes queue status.
4. Rollback: delete `modules/queues`, revert `app.module.ts` and `health` changes. Redis and existing features remain unaffected.

## Open Questions

- [x] Should `@nestjs/bull` be removed from `package.json` now, or kept in case another feature depends on it? — **Removed** (it peer-depends on `bull` which is not installed).
- [x] Do we need a `defaultJobOptions` global override in `BullModule.forRootAsync`, or keep defaults per-producer? — **Per-producer** for flexibility.
- [x] Should queue health indicator list ALL queues automatically, or only explicitly registered ones? — **Explicit registration** to avoid leaking internal/test queues.
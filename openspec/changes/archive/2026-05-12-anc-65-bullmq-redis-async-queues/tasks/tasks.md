# Tasks: anc-65-bullmq-redis-async-queues

## Phase 1: Package & Config

- [x] 1.1 Update package.json: replace `@nestjs/bull` with `@nestjs/bullmq`
- [x] 1.2 Update `redis.config.ts` for BullMQ connection shape (optional `db`, optional `password`)
- [x] 1.3 Update `.env.example` with queue env docs

## Phase 2: Shared Queue Module

- [x] 2.1 Create `queues/constants/queue-names.ts`
- [x] 2.2 Create `queues/interfaces/job-payload.interface.ts`
- [x] 2.3 Create `queues/producers/base-queue.producer.ts`
- [x] 2.4 Create `queues/producers/example-queue.producer.ts`
- [x] 2.5 Create `queues/workers/example-queue.worker.ts`
- [x] 2.6 Create `queues/queues.module.ts`

## Phase 3: App Wiring

- [x] 3.1 Update `app.module.ts` to import `QueuesModule`

## Phase 4: Health Integration

- [x] 4.1 Create `health/indicators/queue.indicator.ts`
- [x] 4.2 Update `health/health.service.ts` to include queue indicator
- [x] 4.3 Update `health/health.module.ts` for queue dependencies

## Phase 5: Tests

- [x] 5.1 Write tests for queues module bootstrap (`queues.module.spec.ts`)
- [x] 5.2 Write tests for base producer (`base-queue.producer.spec.ts`)
- [x] 5.3 Write tests for example producer (`example-queue.producer.spec.ts`)
- [x] 5.4 Write tests for example worker (`example-queue.worker.spec.ts`)
- [x] 5.5 Write tests for queue health indicator (`queue.indicator.spec.ts`)
- [x] 5.6 Update tests for health service/route (`health.service.spec.ts`, `health.route.spec.ts`)

## Additional Verification Fixes Applied

- [x] Fixed payload validation in base producer with class-validator
- [x] Added E2E terminal-state tests for real BullMQ completed/failed proof
- [x] Cleaned up stale `@nestjs/bull` from package.json and bun.lock
- [x] Added Redis auto-start to Jest global-setup for terminal tests
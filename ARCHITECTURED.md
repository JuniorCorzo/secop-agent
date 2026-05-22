# Architecture: Plataforma Licitaciones SECOP

> `secop-agent` — Colombian public bidding analysis and recommendation platform.

---

## 1. System Overview

| Layer           | Technology                                            |
| --------------- | ----------------------------------------------------- |
| Backend         | NestJS 11 (TypeScript strict)                         |
| Frontend        | React 19 + Vite 6 + TailwindCSS 4                     |
| Database        | PostgreSQL 16 + pgvector                              |
| Cache / Queue   | Redis 7 + BullMQ                                      |
| ORM             | TypeORM (migration-first, `synchronize: false`)       |
| Auth            | JWT + Passport (`@nestjs/jwt`, `@nestjs/passport`)    |
| Validation      | `class-validator` DTOs + global `ValidationPipe`      |
| Scheduler       | `@nestjs/schedule` (cron-based SODA ingestion cycles) |
| Package Manager | Bun 1.3                                               |
| Testing         | Jest 29 + ts-jest (strict TDD for NestJS)             |
| Monorepo        | Bun workspaces: `apps/nest`, `apps/web`               |
| SDD             | OpenSpec CLI + Engram persistence                     |

---

## 2. Domain

The platform analyzes **SECOP** (Colombian Electronic Public Procurement System) data — ~21.8M historical procurement records from `datos.gov.co` via Socrata SODA 3.0 API.

Core business questions:

1. **What opportunities are open now?** — filter by status, sector, value
2. **What's worth pursuing?** — scoring and market analysis
3. **Who do I compete against?** — competitive intelligence

---

## 3. Backend Architecture

### 3.1 Directory Structure

```
apps/nest/src/
├── main.ts                          # Bootstrap: ValidationPipe, CORS, prefix
├── app.module.ts                    # Root module: all feature modules registered
├── data-source.ts                   # TypeORM CLI data source (migrations)
├── config/                          # Config factories
│   ├── app.config.ts
│   ├── auth.config.ts
│   ├── database.config.ts
│   ├── redis.config.ts
│   ├── hermes.config.ts
│   ├── llm.config.ts
│   ├── typeorm.options.ts           # Runtime TypeORM options (entities array)
│   └── env.validation.ts           # class-validator env schema
├── common/                          # Shared infrastructure
│   ├── common.module.ts
│   ├── entities/schema-health.entity.ts
│   ├── pipes/
│   ├── interceptors/
│   ├── guards/
│   ├── filters/
│   └── decorators/
├── modules/                         # Feature modules
│   ├── auth/                        # ✅ Implemented
│   ├── procurement-notices/         # ✅ Implemented
│   ├── soda-ingestion/              # ✅ Implemented (SODA API streaming + cursor pagination)
│   ├── queues/                      # ✅ Implemented (BullMQ producers/sandboxed workers)
│   ├── health/                      # ✅ Implemented (Terminus indicators)
│   ├── companies/                   # Placeholder
│   ├── competitors/                 # Placeholder
│   ├── scoring/                     # Placeholder
│   ├── documents/                   # Placeholder
│   ├── rag/                         # Placeholder
│   ├── llm/                         # Placeholder
│   ├── alerts/                      # Placeholder
│   └── audit/                       # Placeholder
└── migrations/                      # TypeORM migration files
```

### 3.2 Feature Module Pattern

Every implemented module follows this internal structure:

```
modules/<feature>/
├── <feature>.module.ts              # Module definition + dependency wiring
├── controllers/
│   └── <feature>.controller.ts      # Route handlers, guards, decorators
├── services/
│   └── <feature>.service.ts         # Business logic, repository orchestration
├── entities/
│   └── <entity>.entity.ts           # TypeORM entity with column decorators
├── dto/
│   ├── create-<entity>.dto.ts       # class-validator input DTO
│   ├── update-<entity>.dto.ts       # PartialUpdate DTO (extends create)
│   ├── search-<entity>.dto.ts       # Query filters + pagination DTO
│   └── <other>.dto.ts               # Domain-specific DTOs
├── *.types.ts                       # Enums, constants, type helpers
└── guards/                          # Guards (optional, if module-specific)
```

### 3.3 Architectural Principles

| Principle                          | Implementation                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| **Feature modules**                | Each domain in its own `@Module` with controllers, services, DTOs, entities     |
| **Constructor injection**          | All dependencies explicit in constructor parameters                             |
| **Single-responsibility services** | Services focus on one domain; orchestration in controllers                      |
| **Repository pattern**             | `@InjectRepository(Entity)` in services; QueryBuilder for complex queries       |
| **No circular deps**               | Modules only import what they directly depend on                                |
| **Explicit exports**               | Services/guards exported only when consumed by other modules                    |
| **DTO-first validation**           | All inputs validated via `class-validator` decorators + global `ValidationPipe` |
| **HTTP exceptions from services**  | Services throw `NotFoundException`, `ConflictException`, `BadRequestException`  |

---

## 4. Implemented Modules

### 4.1 Auth Module (`modules/auth`)

**Purpose**: JWT authentication + role-based access control.

```
auth/
├── auth.module.ts
├── controllers/auth.controller.ts       # POST /auth/register, POST /auth/login
├── services/auth.service.ts             # Login, register, token generation
├── services/admin-seed.service.ts       # Seeds default admin on bootstrap
├── strategies/jwt.strategy.ts           # Passport JWT strategy
├── guards/jwt-auth.guard.ts             # Global auth guard
├── guards/roles.guard.ts                # RBAC guard (admin | analista)
├── decorators/roles.decorator.ts        # @Roles(UserRole.admin, ...)
├── decorators/current-user.decorator.ts # @CurrentUser() param decorator
├── entities/user.entity.ts              # User entity (email, password, role)
├── dto/login.dto.ts
├── dto/register.dto.ts
└── types/auth.types.ts
```

**Roles**: `admin`, `analista`

**Flow**:

1. Client → `POST /api/auth/login` → JWT signed → access token returned
2. Subsequent requests → `Authorization: Bearer <token>` → `JwtAuthGuard` validates
3. `RolesGuard` checks `@Roles()` metadata on route handlers

### 4.2 SODA Ingestion Module (`modules/soda-ingestion`)

**Purpose**: Fetch and stream SECOP I/II data from `datos.gov.co` SODA 3.0 API into BullMQ.

```
soda-ingestion/
├── soda-ingestion.module.ts
├── soda-ingestion.types.ts              # SecopIRecord, SecopIIRecord, DatasetFailureState
├── mappers/
│   ├── secop-i.mapper.ts                # SECOP I (f789-7hwg) → unified DTO
│   └── secop-ii.mapper.ts               # SECOP II (p6dx-8zbt) → unified DTO
└── services/
    ├── soda-client.service.ts            # SODA API HTTP client (offset + cursor pagination)
    ├── soda-ingestion.service.ts         # Orchestrator: cron + bootstrap cycles
    └── soda-streamer.service.ts          # Cursor-based streaming + micro-batch enqueuing
```

**Architecture decisions**:

| Decision                                          | Rationale                                                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Cursor-based pagination** (`$order` + `$where`) | Offset-based (`$limit`+`$offset`) degrades O(n²) at 15M+ records. Cursor is O(1) per page.         |
| **Micro-batch enqueuing** (1000 records/job)      | Prevents 15M individual BullMQ jobs collapsing Redis. 15K jobs instead of 15M.                     |
| **Stream-each-page-immediately**                  | Never accumulates full dataset in RAM. Constant memory regardless of dataset size.                 |
| **Cancel/Reject filter in-stream**                | `CANCELLED` and `REJECTED` notices are filtered before enqueuing. Dead processes never hit the DB. |
| **Incremental cron** (`lastRunTimestamp`)         | Only fetches records newer than the last successful run. Bootstrap = full fetch.                   |

**Flow**:

```
@Cron('0 */6 * * *') or onApplicationBootstrap
  → SodaIngestionService.runIngestionCycle()
    → SodaStreamerService.streamToQueue()
      → SodaClientService.fetchPageCursor()    (cursor pagination)
      → mapSecopI / mapSecopII                 (DTO mapping)
      → filter cancelled/rejected              (skip dead)
      → accumulate micro-batch (1000 records)
      → ProcurementIngestionProducer.add()     (enqueue to BullMQ)
      → next page (cursor = last record's timestamp)
```

**Resilience**:

- `maxRetriesPerRequest: null` on Redis connections (mandatory for BullMQ)
- 3 retries with exponential backoff (1s, 2s, 4s) on SODA API calls
- `failureState` per dataset: tracks consecutive failures, logs ERROR at 3
- `Promise.allSettled` for parallel SECOP I + II: one failing doesn't block the other

### 4.3 Procurement Notices Module (`modules/procurement-notices`)

**Purpose**: Persist and query SECOP procurement notices with lifecycle tracking.

```
procurement-notices/
├── procurement-notices.module.ts
├── controllers/procurement-notices.controller.ts  # REST CRUD + bulk + lifecycle
├── services/procurement-notices.service.ts         # Business logic
├── services/ingestion.service.ts                   # Queue-based async bulk ingest
├── entities/procurement-notice.entity.ts           # TypeORM entity (16 columns)
├── dto/create-procurement-notice.dto.ts
├── dto/update-procurement-notice.dto.ts
├── dto/search-procurement-notice.dto.ts             # Filters + pagination
├── dto/lifecycle-transition.dto.ts
├── dto/bulk-ingestion.dto.ts
└── procurement-notice.types.ts                      # Status enum, transitions, types
```

**Entity**: `ProcurementNotice` (unified SECOP I + II schema, 25+ columns)

**Lifecycle State Machine**:

```
PENDING → ENRICHING → SCORING → AWARDED
                              → REJECTED
                              → CANCELLED
```

Transitions are validated in `canTransitionProcurementNoticeStatus()`.

**Endpoints**:
| Method | Path | Guards | Purpose |
|--------|------|--------|---------|
| `POST` | `/api/procurement-notices` | JWT + Roles(admin, analista) | Create single notice |
| `GET` | `/api/procurement-notices` | JWT | Search with filters + pagination |
| `GET` | `/api/procurement-notices/:id` | JWT | Get by UUID |
| `PATCH` | `/api/procurement-notices/:id` | JWT + Roles(admin, analista) | Partial update |
| `PATCH` | `/api/procurement-notices/:id/lifecycle` | JWT + Roles(admin, analista) | Advance lifecycle |
| `POST` | `/api/procurement-notices/bulk-ingest` | JWT + Roles(admin, analista) | Async batch ingest (via BullMQ) |
| `DELETE` | `/api/procurement-notices/:id` | JWT + Roles(admin) | Soft delete |

**Search**: `findAll(query)` uses `createQueryBuilder` with:

- `andWhere` for filters (status, sector, etc.)
- `ILIKE` for text search on title/description
- `orderBy` for dynamic sorting
- `skip/take` for pagination
- Returns `{ data, total, page, limit }`

**Duplicate Protection**:

- Individual `create()` catches `QueryFailedError` (unique constraint on `secop_id`) → `ConflictException`
- Bulk ingest via `upsert()` on `secopId` in chunks of 50

### 4.4 Queues Module (`modules/queues`)

**Purpose**: Async job processing via BullMQ with sandboxed workers for fault isolation.

```
queues/
├── queues.module.ts
├── constants/queue-names.ts
├── interfaces/job-payload.interface.ts
├── processors/
│   └── import-processor.ts              # Sandboxed processor (standalone, no NestJS DI)
├── producers/
│   ├── base-queue.producer.ts            # Abstract producer with retry/error handling
│   ├── example-queue.producer.ts         # Template for new producers
│   ├── procurement-ingestion.producer.ts # Enqueues micro-batch ingest jobs
│   └── scoring-dispatch.producer.ts      # Enqueues scoring jobs
└── workers/
    ├── example-queue.worker.ts           # Template for new workers
    └── procurement-ingestion.worker.ts   # Logic class (testable, not the runtime processor)
```

**Queue Names**: `example`, `procurement-notice-ingestion`, `scoring`, `alerts`, `document-processing`

**Sandboxed Processor** (`processors/import-processor.ts`):

- Runs in isolated Bun worker thread (`useWorkerThreads: true`)
- Own TypeORM `DataSource` — no NestJS DI in the thread
- Crashes in the processor don't kill the main NestJS process
- CPU-intensive work (dedup, mapping) doesn't block the event loop
- Heartbeats always delivered — no stalled jobs from event loop blocking

**Worker lifecycle**:

- Created via factory provider with `Worker` constructor (not `@Processor()` decorator)
- `concurrency: 5` — processes 5 jobs in parallel across worker threads
- Closes gracefully on `OnApplicationShutdown`

### 4.5 Health Module (`modules/health`)

**Purpose**: Liveness/readiness probes for Kubernetes.

```
health/
├── health.module.ts
├── health.controller.ts
└── indicators/
    ├── postgres.indicator.ts
    ├── redis.indicator.ts
    ├── http.indicator.ts
    └── queue.indicator.ts
```

Uses `@nestjs/terminus` with `HealthCheckService` and custom indicators.

---

## 5. Infrastructure & Configuration

### 5.1 Environment Validation

`apps/nest/src/config/env.validation.ts` uses `class-validator` + `class-transformer` to validate all environment variables at startup. The app **fails fast** on misconfiguration.

Key variables: `PORT`, `NODE_ENV`, `DB_*`, `JWT_SECRET`, `REDIS_*`, `SODA_API_URL`, `SODA_APP_TOKEN`, `SODA_DATASET_SECOP1`, `SODA_DATASET_SECOP2`, `SODA_PAGE_SIZE`, `SODA_MAX_PAGES`, `SODA_CRON`.

### 5.2 Configuration Factories

| Config     | File                 | Consumed by                                             |
| ---------- | -------------------- | ------------------------------------------------------- |
| `app`      | `app.config.ts`      | `main.ts` (port)                                        |
| `database` | `database.config.ts` | `typeorm.options.ts`                                    |
| `auth`     | `auth.config.ts`     | `AuthModule` (JWT secret, expiry)                       |
| `redis`    | `redis.config.ts`    | `QueuesModule` (BullMQ connection)                      |
| `soda`     | `soda.config.ts`     | `SodaIngestionModule` (API URL, token, page size, cron) |
| `hermes`   | `hermes.config.ts`   | Hermes integration (future)                             |
| `llm`      | `llm.config.ts`      | LLM provider (future)                                   |

### 5.3 Database

- **TypeORM** with `synchronize: false` (migration-first)
- **Entities** must be registered in **two places**:
  1. `config/typeorm.options.ts` → `entities: [...]` (runtime)
  2. `data-source.ts` → `entities: [...]` (CLI migrations)
- **Migrations**: stored in `apps/nest/src/migrations/`, generated via TypeORM CLI
- **Extensions**: `pgvector` (vector search), `pg_trgm` (trigram indexes for ILIKE)

### 5.4 Redis + BullMQ

- Redis used exclusively as BullMQ backend (async job queues)
- Queue names defined as constants in `constants/queue-names.ts`
- Jobs support retry with exponential backoff
- `base-queue.producer.ts` provides reusable producer pattern
- **`maxRetriesPerRequest: null`** mandatory on all Redis connections — prevents ioredis async exceptions that silently crash workers
- **Sandboxed processors** with `useWorkerThreads: true` for isolation from the NestJS event loop

---

## 6. API Design

### 6.1 Global Settings

```typescript
// main.ts
app.setGlobalPrefix("api"); // All routes under /api
app.useGlobalPipes(
  new ValidationPipe({
    // class-validator on all routes
    whitelist: true, // Strip unknown properties
    transform: true, // Auto-transform types
    forbidNonWhitelisted: true, // Reject unknown properties
  }),
);
app.enableCors();
```

### 6.2 Module Registration

All 12 feature modules registered in `AppModule`:

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TypeOrmModule.forRootAsync({ ... }),
    CommonModule,
    AuthModule, CompaniesModule, CompetitorsModule,
    ProcurementNoticesModule, DocumentsModule, HealthModule,
    LlmModule, QueuesModule, RagModule, ScoringModule,
    AlertsModule, AuditModule,
  ],
})
export class AppModule {}
```

---

## 7. Data Flow

```
┌─────────────────┐     SODA 3.0 API         ┌──────────────────┐
│  SECOP Data      │ ───────────────────────→ │  SodaClientSvc   │
│  (datos.gov.co)  │    cursor pagination     │  fetchPageCursor │
└─────────────────┘    ($order + $where)      └────────┬─────────┘
                                                       │ page by page
                                                       ▼
                                                ┌──────────────────┐
                                                │  SodaStreamerSvc │
                                                │  map + filter    │
                                                │  micro-batch 1K  │
                                                └────────┬─────────┘
                                                         │ enqueue
                                                         ▼
                                                ┌──────────────────┐
                                                │  BullMQ Queue    │
                                                │  (Redis)         │
                                                └────────┬─────────┘
                                                         │ sandboxed
                                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Bun Worker Thread (JSC, isolated)                              │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  import-processor.ts                                      │ │
│  │  ├── own TypeORM DataSource                               │ │
│  │  ├── deduplicate → upsert (chunks of 5000)                │ │
│  │  └── update IngestionJob tracking                         │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                                         │
                                                         ▼
                                                ┌──────────────────┐
                                                │  PostgreSQL      │
                                                │  + pgvector      │
                                                └──────────────────┘

Lifecycle Flow (in-app):
  PENDING ──→ ENRICHING ──→ SCORING ──→ AWARDED
                                     ├─→ REJECTED
                                     └─→ CANCELLED

  Note: CANCELLED and REJECTED notices are filtered at ingestion time
  and never persisted. Only PENDING → AWARDED notices enter the DB.
```

---

## 8. Frontend (apps/web)

React 19 + Vite 6 + TailwindCSS 4. Currently scaffold only with `App.tsx` and `main.tsx`. No test runner configured yet. All business logic currently in backend.

---

## 9. Testing Strategy

| Type              | Runner                 | Location                              | Status    |
| ----------------- | ---------------------- | ------------------------------------- | --------- |
| Unit (service)    | Jest + ts-jest         | `apps/nest/test/*.service.spec.ts`    | ✅ Active |
| Unit (controller) | Jest + ts-jest         | `apps/nest/test/*.controller.spec.ts` | ✅ Active |
| DTO validation    | Jest + class-validator | `apps/nest/test/*.dto.spec.ts`        | ✅ Active |
| Integration       | Not yet implemented    | —                                     | ❌        |
| E2E               | Not yet implemented    | —                                     | ❌        |
| Frontend          | No test runner         | —                                     | ❌        |

**TDD**: Strict mode enabled for NestJS. Tests run via `bun run --cwd apps/nest test`.

**Test Pattern**: Constructor injection with manually mocked dependencies (no `TestingModule` overhead):

```typescript
const mockRepo = { find: jest.fn(), save: jest.fn() } as any;
const service = new ProcurementNoticesService(mockRepo);
```

---

## 10. Development Workflow

### 10.1 SDD (Spec-Driven Development)

All changes follow OpenSpec CLI workflow:

```
/sdd-new <change-name>      → Initialize change
  → sdd-explore             → Investigate codebase
  → sdd-propose             → Create proposal
  → sdd-spec                → Write requirements + scenarios
  → sdd-design              → Technical design
  → sdd-tasks               → Implementation checklist
  → sdd-apply               → Write code (TDD: red → green → refactor)
  → sdd-verify              → Validate against specs
  → sdd-archive             → Sync delta specs to main + archive change
```

Artifacts stored in:

- `openspec/changes/<name>/` (file-based, git-friendly)
- Engram (persistent memory, for traceability)

### 10.2 Git & PR

- **Conventional commits**: `feat(scope):`, `fix(scope):`, `test(scope):`, `chore:`
- **Branch naming**: `type/description` (e.g., `feat/procurement-notices`)
- **PRs linked to Linear issues**: includes `Closes ANC-NN`

### 10.3 Linear Integration

Issues tracked in Linear (team: `AngelCorzo`, project: `Plataforma Licitaciones SECOP - MVP`). Branch names stored as `gitBranchName` in issue metadata for auto-linking.

---

## 11. Placeholder Modules (Future)

| Module        | Purpose                                                            |
| ------------- | ------------------------------------------------------------------ |
| `companies`   | Company catalog with profiles, capabilities, experience            |
| `competitors` | Competitive intelligence from SECOP award data                     |
| `scoring`     | Viability scoring engine (0-100) per company-notice pair           |
| `documents`   | Document processing pipeline (PDF, DOCX → structured)              |
| `rag`         | Hybrid RAG system for SECOP pliegos/adendas search                 |
| `llm`         | Provider-agnostic LLM integration for explanations/recommendations |
| `alerts`      | Notification system for new matching opportunities                 |
| `audit`       | Action audit trail and explainability records                      |

---

## 12. Key Decisions

| Decision                                                  | Rationale                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Migration-first over `synchronize: true`**              | Safe, versioned, reversible schema changes                                                  |
| **QueryBuilder over find-options for search**             | Dynamic filters require conditional `andWhere` chains                                       |
| **BullMQ over `@nestjs/schedule`**                        | Retry, backoff, monitoring, distributed workers                                             |
| **Service throws HTTP exceptions**                        | Keeps controllers thin; exception filters handle mapping                                    |
| **No repository classes**                                 | `@InjectRepository` + QueryBuilder is sufficient; avoids unnecessary abstraction            |
| **English naming for domain**                             | `ProcurementNotice` over `Convocatoria` for code/API consistency                            |
| **Dual entity registration**                              | TypeORM requires entities in both runtime config AND CLI data source                        |
| **Cursor pagination over offset (`$order`+`$where`)**     | Offset degrades O(n²) at 15M+ records; cursor is O(1) per page                              |
| **Micro-batch enqueuing (1000/job) over per-record jobs** | 15M individual jobs would collapse Redis; 15K batches is manageable                         |
| **Cancel/Reject filter at ingestion**                     | Dead processes never hit the DB — saves storage, simplifies queries                         |
| **Sandboxed processors with `useWorkerThreads: true`**    | Fault isolation: crashes kill one worker thread, not the process. Event loop never blocked. |
| **`maxRetriesPerRequest: null` on all Redis connections** | Mandatory for BullMQ — prevents ioredis async exceptions that cause silent worker failures  |

---

## 13. Running the System

```bash
# Start infrastructure
docker compose up -d

# Install dependencies
bun install

# Run migrations
bun run --cwd apps/nest migration:run

# Start backend (dev)
bun run --cwd apps/nest dev

# Run tests
bun run --cwd apps/nest test

# Start frontend (dev)
bun run --cwd apps/web dev
```

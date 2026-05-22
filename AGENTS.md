# AGENTS.md — secop-agent

> ⚠️ **Conventions**: All development MUST follow SOLID, YAGNI, and KISS. See [CONVENTIONS.md](./CONVENTIONS.md) for the full breakdown.

## Stack

| Layer       | Tech                                               |
| ----------- | -------------------------------------------------- |
| Backend     | NestJS 11 (TS strict) + Express                    |
| Frontend    | React 19 + Vite 6 + TailwindCSS 4                  |
| DB          | PostgreSQL 17 + pgvector                           |
| Queue/Cache | Redis 7 + BullMQ                                   |
| ORM         | TypeORM 0.3 (migration-first)                      |
| Auth        | JWT + Passport (`@nestjs/jwt`, `@nestjs/passport`) |
| Test        | Jest 29 + ts-jest (TDD for backend)                |
| Package     | Bun 1.3 workspaces (`apps/nest`, `apps/web`)       |
| SDD         | OpenSpec CLI + Engram                              |

## Must-Know Commands

```bash
# Infrastructure
docker compose up -d               # Start postgres + redis
docker compose down                # Stop

# Backend
bun run --cwd apps/nest dev        # NestJS dev server (:3000)
bun test                            # Run all tests (root)
bun run --cwd apps/nest test       # Run Nest tests only
bun run --cwd apps/nest test:cov   # With coverage
bun run test:cov                    # Root alias

# Migrations (run from apps/nest)
bun run --cwd apps/nest migration:generate -- src/migrations/<Name>
bun run --cwd apps/nest migration:run
bun run --cwd apps/nest migration:revert

# Frontend
bun run --cwd apps/web dev         # Vite dev server (:5173)

# Lint
bun run lint                       # Both apps (root)
bun run --cwd apps/nest lint       # Nest only
```

**Never run `bun run build` or `bun run build:nest`** — build is forbidden by convention.

## Critical Gotchas

### Dual Entity Registration

Adding a new TypeORM entity requires registering it in **TWO places**:

1. `apps/nest/src/config/typeorm.options.ts` → `entities: [...]` (runtime)
2. `apps/nest/src/data-source.ts` → `entities: [...]` (CLI/migrations)

Missing either causes runtime errors or migration failures.

### Migration Stub

TypeORM CLI requires `ts-node` which doesn't work under Bun. All migration commands use `-r ./scripts/typeorm-stub.ts` to stub `ts-node/register`. This is already wired in `package.json` scripts — always use those scripts, never run TypeORM CLI directly.

### `synchronize: false`

Schema changes are migration-only. No `synchronize: true`. Every entity change needs a migration.

### Docker Dependencies

Tests that hit the DB need `docker compose up -d` first. Config values:

- DB: `localhost:5432`, user `secop`, pass `secop_dev`, db `secop_agent`
- Redis: `localhost:6379`

### Never Commit `.env` Files

`.env` and `*.env` are gitignored. Use `.env.example` for reference. Environment is validated at startup via `config/env.validation.ts`.

## Architecture

### Module Structure

```
apps/nest/src/modules/<feature>/
├── <feature>.module.ts
├── controllers/
├── services/
├── entities/
├── dto/
└── guards/            # if feature-specific
```

**12 modules** registered in `AppModule`:

- ✅ Auth (JWT+Roles), ProcurementNotices, Queues, Health
- Placeholder: Companies, Competitors, Scoring, Documents, RAG, LLM, Alerts, Audit

### Patterns

- **Constructor injection** only — no property injection, no `ModuleRef.get()`
- **Repository via `@InjectRepository(Entity)`** — no custom repository classes unless query complexity demands it
- **Services throw HTTP exceptions** — controllers stay thin
- **DTOs + `class-validator`** on every input — global `ValidationPipe` strips unknown props
- **QueryBuilder for dynamic queries** — `createQueryBuilder` with conditional `andWhere` chains
- **No circular deps** — extract shared logic to `CommonModule`

### Auth

- Global: `JwtAuthGuard` + `RolesGuard` on procurement-notices endpoints
- Roles: `admin`, `analista`
- Decorators: `@Roles(Role.admin)` on routes, `@CurrentUser()` for user param
- Guards exported from `AuthModule` — import `AuthModule` in feature modules that need auth

### Queues

- `QueuesModule` provides BullMQ producers/workers
- Queue names: `example-queue`, `procurement-notice-ingestion`
- Producer pattern: `BaseQueueProducer` abstract class with retry/error handling
- Redis config via `ConfigService` (from env)

### Data Ingestion

**Online (SODA API)** — `SodaIngestionService` runs on app bootstrap and via cron (`@Cron('0 */6 * * *')`). Fetches from SECOP_I (`f789-7hwg`) and SECOP_II (`p6dx-8zbt`) datasets incrementally using cursor-based pagination with persistent state in `ingestion_state` table.

## Testing

### Commands

```bash
bun test                                    # All tests (root)
bun run --cwd apps/nest test               # Nest tests only
bun run --cwd apps/nest test -- --testPathPattern="procurement"  # Single suite
```

### Conventions

- Tests live in `apps/nest/test/`, **not** co-located with source
- File naming: `*.spec.ts` (matched by jest `testMatch`)
- **Simple constructor injection** with manual mocks — no `TestingModule` unless needed
- `reflect-metadata` imported in `test/setup.ts` (global setup)
- Path alias `@/*` → `src/*` works in both TypeScript and Jest
- **TDD is strict** for NestJS: write failing test → implement → refactor
- Frontend has **no test runner** — do not attempt TDD for `apps/web`

### Example Test

```typescript
const mockRepo = { find: jest.fn(), save: jest.fn() };
const service = new Service(mockRepo as any);
```

## Domain

- **SECOP**: Colombian public procurement system (~21.8M records, SODA 3.0 API)
- **ProcurementNotice lifecycle**: `PENDING → ENRICHING → SCORING → AWARDED | REJECTED | CANCELLED`
- Transitions validated via `canTransitionProcurementNoticeStatus()` in `procurement-notice.types.ts`
- English naming: `ProcurementNotice` (not `Convocatoria`)

## Git & PR

- **Conventional commits**: `feat(scope):`, `fix(scope):`, `test(scope):`, `docs:`, `chore:`
- **No AI attribution**: never add `Co-Authored-By` or similar trailers
- **PRs link Linear issues** via `Closes ANC-NN`
- Branch naming from Linear `gitBranchName`
- No GitHub Actions / CI configured yet

## SDD Workflow

All changes follow OpenSpec:

```
openspec new change "name"     → create change
openspec status --change "name" → check progress
openspec archive <name> -y     → archive completed change
```

Artifacts: `proposal.md` → `specs/` → `design.md` → `tasks.md` → implement → archive.
Spec delta syntax: `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`.

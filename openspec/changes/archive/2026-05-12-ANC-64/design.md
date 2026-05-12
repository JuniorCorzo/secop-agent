# ANC-64 Design

## Approach
Use `@nestjs/config` as the single startup boundary. Validate env upfront with `class-validator`/`class-transformer`, then read runtime settings from `ConfigService`.

## Components
- `src/config/env.validation.ts` — validation gate and typed env contract.
- `src/config/*.ts` — pure config mapping helpers.
- `src/modules/health/` — `/api/health` endpoint and dependency checks.
- `apps/nest/.env.example` — complete variable catalog.

## Health strategy
- Postgres: `SELECT 1` via TypeORM `DataSource`.
- Redis: TCP connect check with short timeout.
- Hermes/LLM: HTTP GET `/health` with short timeout.

## Tradeoffs
- TCP Redis check is lighter than adding a new client package in this slice.
- CLI data-source still has env access for TypeORM bootstrap; runtime paths are the main target.

# Proposal: ANC-64 Env, Secrets, and Health Checks

## Executive Summary

ANC-64 hardens runtime readiness: validated configuration, safer secret handling, and `/api/health` checks for core dependencies. Current config factories and `main.ts` read `process.env` directly; this change moves runtime consumers to `ConfigService` with startup validation.

## Intent

Make the SECOP licitaciones MVP fail fast on invalid environment variables, avoid unsafe secret exposure, and expose one operational health endpoint for deploy/runtime checks.

## Scope

### In Scope
- Add env schema validation for app, Postgres, Redis, Hermes, and LLM/OpenCode settings.
- Refactor runtime config consumption from direct `process.env` parsing to validated `ConfigService` access.
- Add `/api/health` with checks for Postgres, Redis, Hermes, and LLM/OpenCode.
- Expand `.env.example` with required non-secret placeholders and secret naming.

### Out of Scope
- Secret manager integration (Vault/AWS/GCP/1Password) beyond env-based conventions.
- Business-domain health semantics beyond connectivity/readiness.
- Frontend config UI or admin diagnostics.

## Capabilities

### New Capabilities
- `runtime-configuration`: Validated env/config contract and safe secret conventions for backend runtime.
- `service-health`: Operational readiness endpoint covering infrastructure and external integrations.

### Modified Capabilities
- None — no existing `openspec/specs/` capabilities found.

## Approach

- Introduce `src/config/env.validation.ts` using `class-validator`/`class-transformer` or equivalent Nest config validation.
- Keep existing `src/config/*.ts` shape for future module-specific config wiring, but stop ad-hoc parsing in runtime paths.
- Update `AppModule` TypeORM factory and `main.ts` to use validated `ConfigService` values.
- Add Redis config (`src/config/redis.config.ts`) and health module/controller/service under `src/modules/health/`.
- Implement `/api/health` with structured response and timeout-bounded checks: TypeORM/Postgres, Redis ping, Hermes URL probe, LLM/OpenCode URL probe/API-key presence.
- Redact secrets in logs/responses; validate presence and formats, never return values.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/nest/src/config/` | Modified/New | Validation schema, Redis config, typed factories |
| `apps/nest/src/app.module.ts` | Modified | Load validated config, inject `ConfigService` correctly |
| `apps/nest/src/main.ts` | Modified | Read port from `ConfigService` |
| `apps/nest/src/modules/health/` | New | `/api/health` endpoint and dependency checks |
| `.env.example` | Modified | Document required env vars and secret placeholders |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Startup fails in dev due missing env | Med | Keep sane dev defaults only where safe; document `.env.example` |
| Health probes slow requests | Med | Use short timeouts and parallel checks |
| Secret leakage | Low | Redact outputs; never serialize secret values |

## Rollback Plan

Revert ANC-64 changes, remove health module import, restore previous `ConfigModule.forRoot({ isGlobal: true })` and direct config factory behavior. `/api/health` disappears; app returns to prior env defaults.

## Dependencies

- Existing `@nestjs/config`, `class-validator`, `class-transformer`, TypeORM, Postgres, Redis.
- Likely add Redis client package if BullMQ Redis connection is not reusable.

## Success Criteria

- [ ] App fails fast with clear message for invalid required env.
- [ ] Runtime code uses `ConfigService`/validated config instead of direct `process.env` parsing.
- [ ] `GET /api/health` returns status for Postgres, Redis, Hermes, and LLM/OpenCode.
- [ ] Health response contains no secret values.
- [ ] `.env.example` documents all required ANC-64 variables.

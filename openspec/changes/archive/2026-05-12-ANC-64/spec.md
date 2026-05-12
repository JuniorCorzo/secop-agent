# ANC-64 Specification

## Purpose
Harden backend startup and operational readiness with validated env config, safer secret handling, and a single health endpoint.

## Goals
- Fail fast when required env is invalid or missing.
- Stop relying on ad-hoc `process.env` reads in runtime paths.
- Expose `GET /api/health` for core dependencies.
- Document all runtime variables in `.env.example`.

## Non-goals
- External secret manager integration.
- Full business-domain monitoring.
- Frontend config UI.

## Scenarios
1. Invalid env variables prevent Nest bootstrap.
2. App reads port and dependency settings from `ConfigService`.
3. `GET /api/health` reports Postgres, Redis, Hermes, and LLM readiness.
4. Health responses never include secret values.
5. `.env.example` lists every required ANC-64 variable.

## Acceptance Criteria
- Validation schema covers app, DB, JWT, Redis, Hermes, and LLM env values.
- `AppModule` and `main.ts` consume validated config.
- `HealthModule` exists and is mounted at `/api/health`.
- Health checks are timeout-bounded and parallel.
- Direct secret values are never serialized in logs or responses.

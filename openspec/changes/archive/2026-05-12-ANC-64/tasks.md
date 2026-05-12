# ANC-64 Tasks

## Config validation
- [x] Add env validation schema.
- [x] Add auth/redis config factories.
- [x] Refactor bootstrap to use `ConfigService`.

## Secrets and docs
- [x] Add `.env.example` with all ANC-64 vars.
- [x] Keep secret values out of health responses.

## Health checks
- [x] Add `HealthModule`.
- [x] Implement Postgres readiness check.
- [x] Implement Redis readiness check.
- [x] Implement Hermes and LLM readiness checks.

## Verification
- [x] Add tests for env validation.
- [x] Add tests for health service.
- [x] Re-run verification after tests pass.

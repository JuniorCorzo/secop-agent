# ANC-62 — Spec

## Goal
Create the smallest persistence foundation needed for the MVP: runtime TypeORM wiring, CLI data source, env contract, baseline migration, and a tiny validation entity.

## Non-goals
- No domain model implementation beyond the minimal validation entity
- No repository/service business logic
- No auth, queues, or scoring

## Requirements
1. Nest must read DB config from a shared config factory.
2. TypeORM runtime wiring must use migrations only (`synchronize: false`).
3. A standalone TypeORM `data-source.ts` must exist for CLI operations.
4. `.env.example` must document the required DB variables.
5. Baseline migration must be idempotent and create required extensions safely.
6. One minimal entity must exist to validate entity/migration wiring.

## Acceptance criteria
- App bootstraps with TypeORM configured.
- Migration run/revert works against Docker Postgres.
- Compile passes under Bun.

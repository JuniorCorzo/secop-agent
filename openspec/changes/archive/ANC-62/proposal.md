# ANC-62 — Persistence foundation

## Problem
The Nest app has a DB scaffold in Docker, but no ORM wiring, no CLI data source, no env contract, and no baseline migration. That blocks all domain work.

## Scope
- Wire TypeORM into Nest
- Add shared database config
- Add `.env.example`
- Add `data-source.ts` for TypeORM CLI under Bun
- Add idempotent baseline migration
- Add one tiny validation entity to prove the pipeline

## Out of scope
- Full domain models
- Auth
- Business logic
- Scoring
- RAG

## Why first
Persistence must exist before any module can persist or migrate data.

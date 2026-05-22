---
name: secop-conventions
description: Mandatory SOLID, YAGNI, KISS conventions for secop-agent. Use when writing, reviewing, or refactoring any code in this project. Enforces constructor injection, DTO validation, thin controllers, service responsibility, and query builder patterns.
---

# SECOP Conventions

> Always active when writing code. Non-negotiable.

## SOLID

### S — Single Responsibility
- Services: business logic + throw HTTP exceptions. Controllers: thin, only routes + DTO binding.
- If method does >1 thing (validate + persist + notify) → split.
- ❌ Service that validates, saves, AND enqueues. ✅ Service saves, separate handler enqueues.

### O — Open/Closed
- Add new behavior via new code, never modify existing methods.
- Strategy patterns, DI, abstract base classes. `BaseQueueProducer` is the template.

### L — Liskov Substitution
- Subclass of `BaseQueueProducer` must work exactly like base. No unexpected exceptions.

### I — Interface Segregation
- No monolithic interfaces. Split by concern.
- Repository queries focused — no joined data only some callers need.

### D — Dependency Inversion
- Constructor injection only. `@InjectRepository(Entity)`, never `new Repository()`.
- `ConfigService` for env vars — never `process.env` directly.
- Services injected, not imported + instantiated.

## YAGNI
- No unused columns, premature abstractions, speculative endpoints.
- No caching without perf evidence. No interfaces without second implementation.
- **Counter**: spec requirements are not YAGNI — implement them.

## KISS
- Plain functions > classes when no state needed.
- Simple mocks > NestJS `TestingModule` when possible.
- `as const` + union types > enums unless runtime iteration needed.
- `Map` for dedup > custom data structure.
- 5 readable lines > 1 clever TypeScript generic.

**Pre-merge checklist**:
- Explainable to junior in 2 min?
- Any abstraction I could delete?
- Every line tied to concrete need?

## Code patterns

| Do | Don't |
|----|-------|
| Constructor injection | Property injection, `ModuleRef.get()` |
| `@InjectRepository(Entity)` | Custom repository classes (unless query complexity demands) |
| Services throw HTTP exceptions | Controllers with business logic |
| DTO + `class-validator` on every input | Raw `any` parameters |
| `createQueryBuilder` with conditional `andWhere` | Raw SQL for dynamic queries |
| `QueryBuilder for dynamic queries` | String concatenation for SQL |

## File structure

```
modules/<feature>/
├── <feature>.module.ts
├── controllers/
├── services/
├── entities/
├── dto/
└── guards/
```

Tests in `apps/nest/test/`, not co-located with source. Files named `*.spec.ts`.

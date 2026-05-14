# CONVENTIONS.md — secop-agent

Mandatory development principles applied to every decision, review, and line of code.

## SOLID

### S — Single Responsibility Principle

> A class should have one, and only one, reason to change.

- **Services** handle business logic and throw HTTP exceptions.
- **Controllers** stay thin — only route definition and DTO binding.
- **DTOs** only define shape and validation rules.
- **Entities** only define persistence schema.
- **Guards** only handle authorization logic.
- If a service method does more than one thing (e.g., validate + persist + notify), split it.

❌ A service that validates, saves, and enqueues a job — three reasons to change.
✅ A service that saves, plus a separate handler that enqueues.

### O — Open/Closed Principle

> Open for extension, closed for modification.

- Add new behavior by adding new code, never by modifying existing methods.
- Use strategy patterns, dependency injection, and abstract base classes.
- `BaseQueueProducer` is the template — extend it, don't patch it.
- New notification channel? Add a new `NotificationSender`, don't add `if/else` to the existing one.

### L — Liskov Substitution Principle

> Subtypes must be substitutable for their base types without breaking the program.

- If you extend `BaseQueueProducer`, the consumer must work with the subclass exactly as it works with the base.
- Don't throw unexpected exceptions in subclass overrides.
- Don't strengthen preconditions or weaken postconditions.

### I — Interface Segregation Principle

> No client should depend on methods it doesn't use.

- Don't create monolithic service interfaces. Split by concern.
- A `findAll` method that also handles enrichment is two interfaces pretending to be one.
- Keep repository queries focused — don't return joined data that only some callers need.

### D — Dependency Inversion Principle

> Depend on abstractions, not concretions.

- Constructor injection via NestJS DI — services depend on `@InjectRepository(Entity)`, never instantiate repos directly.
- `ConfigService` for all env vars — never read `process.env` directly.
- Services are injected, not imported and instantiated.
- Use interfaces for contracts between modules (e.g., `IQueueProducer`).

## YAGNI — You Aren't Gonna Need It

> Don't build features based on "we might need this later."

- No unused columns, no premature abstractions, no speculative endpoints.
- A `findBySecopId` exists because the spec requires it. `findByMultipleFilters` doesn't exist yet because nobody asked for it.
- Don't add a caching layer until you have evidence of a performance problem.
- Don't create interfaces "just in case" — create them when you have a second implementation.

**Counter-signal**: When the spec explicitly requires something (e.g., `invalid` reporting in `bulkIngest`), implement it. YAGNI is about guesswork, not about skipping requirements.

## KISS — Keep It Simple, Stupid

> Simplicity is a feature. Complexity is a cost.

- Prefer plain functions over classes when state isn't needed.
- Prefer simple mocks over NestJS `TestingModule` when possible.
- Prefer direct `Repository` methods over raw SQL when the query is simple.
- Prefer `as const` arrays and union types over enums unless you need runtime metadata beyond iteration.
- Five lines that anyone can read > one line of clever TypeScript generics.
- A `Map` for deduplication is simpler than a custom data structure.

**Checklist**: Before merging, ask:
- Can I explain this to a junior developer in 2 minutes?
- Are there any abstractions I could delete and still fulfill the requirement?
- Is every line of code tied to a concrete need (spec, bug, performance evidence)?

---

> These principles are non-negotiable. Every PR review references them. Every architectural decision is validated against them.

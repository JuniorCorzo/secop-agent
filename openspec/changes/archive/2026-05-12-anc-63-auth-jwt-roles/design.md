# Design: ANC-63 Auth Module with JWT and Roles

## Context

ANC-61 scaffolded a 10-module NestJS backbone with empty `AuthModule` placeholder. ANC-62 wired TypeORM with PostgreSQL/pgvector. ANC-64 added env validation with `JWT_SECRET` and `JWT_EXPIRES_IN` already required at startup, plus a working `ConfigService` injection pattern.

Auth dependencies (`@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`) are already in `apps/nest/package.json`.

The current `AuthModule` is an empty shell (`@Module({})`). There is no User entity, no auth endpoints, and no JWT guard. All routes are open.

## Goals / Non-Goals

**Goals:**
- Full JWT auth flow: register → login → receive token → access protected routes
- Role-based authorization: `admin`, `analista`, `viewer` with `@Roles()` decorator
- Password hashing with bcrypt (12 rounds)
- Admin seed user on first run persisted as a normal `User` row in the database
- `JwtAuthGuard` as the default guard; `RolesGuard` for role checks
- Protected `GET /auth/me` returning current user from token
- All new code covered by unit tests matching existing patterns
- Role is sourced from the database, not trusted from JWT payload alone

**Non-Goals:**
- Refresh token rotation (single token only)
- Email verification or password reset flows
- OAuth / social login
- Multi-tenancy or organization-scoped users
- Frontend auth UI or state management

## Decisions

### 1. Standard NestJS JWT + Passport pattern

**Choice**: `@nestjs/jwt` for token signing + `@nestjs/passport` with `passport-jwt` strategy.

**Rationale**: This is the idiomatic NestJS auth pattern. It integrates naturally with Nest's guard/decorator system and the existing `ConfigService`. The JWT module gets `JWT_SECRET` and `JWT_EXPIRES_IN` from `ConfigService` via `registerAsync`.

**Alternatives considered**:
- *Auth0/third-party*: Too heavy for an MVP; introduces external dependency.
- *Sessions*: Requires Redis state; JWT is stateless and simpler for API-first architecture.
- *Custom token logic*: Reinventing the wheel; passport-jwt is battle-tested.

### 2. TypeORM User entity with enum role

**Choice**: `User` entity with `id` (uuid), `email` (unique), `password_hash`, `role` (enum: `admin`, `analista`, `viewer`), `created_at`, `updated_at`.

**Rationale**: TypeORM is already wired (ANC-62). The entity uses standard decorators (`@Entity`, `@Column`, `@PrimaryGeneratedColumn`) and aligns with the existing database config. Roles stored as a string enum for readability and type safety.

**Alternatives considered**:
- *Separate roles table*: Over-engineering for 3 roles. An enum column is sufficient and performant.
- *Mongoose/MongoDB*: Would require a separate database setup. PostgreSQL is already configured.

### 3. bcrypt with 12 cost rounds

**Choice**: Hash passwords with `bcrypt.hash(password, 12)` on registration. Verify with `bcrypt.compare(plaintext, hash)` on login.

**Rationale**: 12 rounds balances security and performance for an MVP. bcrypt is the de facto standard for password hashing in Node.js ecosystems. The hash is stored, never the plaintext.

### 4. ConfigService for JWT values (already validated)

**Choice**: `JwtModule.registerAsync` reads `JWT_SECRET` and `JWT_EXPIRES_IN` from `ConfigService`.

**Rationale**: ANC-64 already validates these at startup. No need for fallback defaults — if missing, the app fails fast with a clear message. The `auth.config.ts` factory from ANC-64 already exports a typed `AuthConfig` interface.

### 5. Module structure inside `src/modules/auth/`

```
src/modules/auth/
├── auth.module.ts          # Registers TypeOrmModule.forFeature([User]), JwtModule, PassportModule
├── auth.controller.ts      # POST /login, POST /register, GET /me
├── auth.service.ts         # validateUser, login, register, generateToken
├── entities/
│   └── user.entity.ts      # TypeORM User entity
├── dto/
│   ├── login.dto.ts        # email + password with class-validator
│   └── register.dto.ts     # email + password + optional role
├── guards/
│   ├── jwt-auth.guard.ts   # Extends AuthGuard('jwt')
│   └── roles.guard.ts      # Reads @Roles() metadata, checks user.role
├── decorators/
│   ├── roles.decorator.ts  # @Roles('admin', 'analista', 'viewer')
│   └── current-user.decorator.ts  # @CurrentUser() param decorator
├── strategies/
│   └── jwt.strategy.ts     # passport-jwt: extracts user id from token, validates against DB
└── seeds/
    └── admin.seed.ts       # OnModuleInit: creates admin user row if none exists
```

**Rationale**: Follows NestJS conventions and the existing project module structure (controllers/, entities/, dto/, services/). Adds guards/, decorators/, strategies/, and seeds/ directories specific to auth.

### 6. Registration default role: `viewer`

**Choice**: `POST /auth/register` assigns `viewer` by default. Only an `admin` can later promote users (out of scope for MVP, but the guard supports it).

**Rationale**: Least-privilege principle. The admin seed user is the only `admin`. Registration is open for MVP simplicity, but new users start with minimal access.

### 7. JWT payload stays minimal

**Choice**: JWT payload carries `sub` (user id) and optional `email`; role is reloaded from the database when validating protected requests.

**Rationale**: This prevents stale role claims from surviving a role change in the database. The DB remains the source of truth for authorization.

**Alternatives considered**:
- *Include role in JWT*: faster checks, but role changes would not apply until token expiry.
- *Include full profile*: unnecessary token bloat and more trust in client-held claims.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Registration is open (no invite flow) → spam accounts | Acceptable for MVP; adds rate limiting in ANC-67 or later |
| No refresh tokens → users re-login after expiry | `JWT_EXPIRES_IN` default is 7d, which is tolerable for v1 |
| Admin seed may fail silently if DB not ready | Use `OnModuleInit` with try/catch; logs warning, doesn't crash |
| `JWT_SECRET` leaked → all tokens compromised | Already required by ANC-64 env validation; documented as secret in `.env.example` |
| bcrypt hashing blocks event loop for large registrations | 12 rounds is ~250ms; acceptable for MVP volume |

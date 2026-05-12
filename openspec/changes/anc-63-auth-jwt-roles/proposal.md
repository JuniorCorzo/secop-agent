# Proposal: ANC-63 Auth Module with JWT and Roles

## Why

The SECOP platform needs authenticated access control before any domain logic can be built. ANC-61 scaffolded an empty `AuthModule` placeholder and ANC-64 wired `JWT_SECRET`/`JWT_EXPIRES_IN` into the config layer. Now the actual auth flow — login, registration, JWT issuance, and role-based guards — must be implemented so downstream modules can protect their endpoints.

## What Changes

- Flesh out `AuthModule` with controller, service, and DTOs for login and register endpoints
- Add `User` entity with id, email, password hash, and role fields
- Implement JWT strategy via `@nestjs/passport` + `passport-jwt`
- Create `RolesGuard` and `@Roles()` decorator supporting `admin`, `analista`, and `viewer` roles
- Expose `POST /auth/login`, `POST /auth/register`, and `GET /auth/me` endpoints
- Seed an initial admin user on first run
- Add `JwtAuthGuard` as the default auth guard for protected routes
- Validate env: `JWT_SECRET` is required at startup (ANC-64 already validates presence)

## Capabilities

### New Capabilities
- `auth-jwt`: JWT-based authentication with login, registration, and token validation
- `auth-roles`: Role-based authorization via `@Roles()` decorator and `RolesGuard`

### Modified Capabilities
- None — no existing `openspec/specs/` capabilities found.

## Impact

| Area | Impact | Description |
|------|--------|-------------|
| `apps/nest/src/modules/auth/` | **BREAKING**: rewritten | Replaces placeholder AuthModule with full implementation |
| `apps/nest/src/modules/auth/entities/` | New | `User` entity with password hashing and role enum |
| `apps/nest/src/modules/auth/controllers/` | New | Auth controller with login, register, me endpoints |
| `apps/nest/src/modules/auth/services/` | New | Auth service with bcrypt hashing and JWT signing |
| `apps/nest/src/modules/auth/dto/` | New | LoginDto, RegisterDto with class-validator decorators |
| `apps/nest/src/modules/auth/guards/` | New | JwtAuthGuard, RolesGuard |
| `apps/nest/src/modules/auth/decorators/` | New | @Roles(), @CurrentUser() decorators |
| `apps/nest/src/modules/auth/strategies/` | New | JwtStrategy (passport-jwt) |
| `apps/nest/src/modules/auth/seeds/` | New | Admin user seed on first run |
| `apps/nest/src/app.module.ts` | Modified | Import AuthModule, register TypeORM User entity |
| `apps/nest/src/config/auth.config.ts` | Existing | Already provides JWT_SECRET and JWT_EXPIRES_IN (ANC-64) |
| Dependencies | Already installed | `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt` |

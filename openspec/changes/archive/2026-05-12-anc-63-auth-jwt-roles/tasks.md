# Tasks: ANC-63 Auth Module with JWT and Roles

## 1. Entity and Database

- [x] 1.1 Create `User` entity with TypeORM decorators: `id` (uuid), `email` (unique), `password_hash`, `role` (enum: admin/analista/viewer), `created_at`, `updated_at`
- [x] 1.2 Register `User` entity in `AuthModule` via `TypeOrmModule.forFeature([User])`
- [x] 1.3 Add a migration that creates the `users` table and unique email index so the admin seed persists in DB

## 2. DTOs

- [x] 2.1 Create `RegisterDto` with class-validator: `email` (@IsEmail), `password` (@MinLength(8)); registration must not accept client-supplied roles
- [x] 2.2 Create `LoginDto` with class-validator: `email` (@IsEmail), `password` (@IsString)
- [x] 2.3 Create response types/interfaces: `AuthResponse` (access_token + user without password_hash) and `UserProfile`

## 3. JWT Strategy

- [x] 3.1 Create `JwtStrategy` extending `PassportStrategy(Strategy)` using `passport-jwt` — reads `JWT_SECRET` from `ConfigService`, validates token payload, and reloads the user from the database
- [x] 3.2 Register `PassportModule.register({ defaultStrategy: 'jwt' })` and `JwtModule.registerAsync` in `AuthModule`

## 4. Auth Service

- [x] 4.1 Implement `AuthService.register(dto)`: hash password with bcrypt (12 rounds), create User as `viewer`, return JWT + user profile
- [x] 4.2 Implement `AuthService.login(dto)`: find user by email, compare password with bcrypt, return JWT + user profile
- [x] 4.3 Implement `AuthService.validateUser(payload)`: find user by id from JWT payload, return the DB-backed user entity for JWT strategy
- [x] 4.4 Implement `AuthService.getProfile(id)`: return user without password_hash

## 5. Auth Controller

- [x] 5.1 Implement `POST /auth/register` — calls `AuthService.register`, returns 201 with `AuthResponse`
- [x] 5.2 Implement `POST /auth/login` — calls `AuthService.login`, returns 200 with `AuthResponse`
- [x] 5.3 Implement `GET /auth/me` protected by `JwtAuthGuard` — returns current user profile

## 6. Guards and Decorators

- [x] 6.1 Create `JwtAuthGuard` extending `AuthGuard('jwt')` in `guards/`
- [x] 6.2 Create `RolesGuard` implementing `CanActivate` — reads `@Roles()` metadata via Reflector, checks `user.role` against allowed roles
- [x] 6.3 Create `@Roles()` decorator using `SetMetadata('roles', [...roles])` in `decorators/`
- [x] 6.4 Create `@CurrentUser()` param decorator using `createParamDecorator` to extract user from request
- [x] 6.5 Register `RolesGuard` as a provider in `AuthModule`, export `JwtAuthGuard` and `RolesGuard`

## 7. Admin Seed

- [x] 7.1 Create `AdminSeedService` implementing `OnModuleInit` — checks if admin exists and persists a real `User` row if not
- [x] 7.2 Add bootstrap admin credentials to env validation and `.env.example` as seed-only inputs

## 8. Module Wiring

- [x] 8.1 Rewrite `AuthModule` to register all providers (AuthService, JwtStrategy, RolesGuard, AdminSeedService), controllers, and exports (JwtAuthGuard, RolesGuard, AuthService)
- [x] 8.2 Ensure `RolesGuard` reads the role from the DB-backed user loaded by `JwtStrategy`

## 9. Tests

- [x] 9.1 Write unit tests for `AuthService` (register, login, validateUser, getProfile) mocking User repository and JwtService
- [x] 9.2 Write unit tests for `AuthController` (all endpoints, error cases)
- [x] 9.3 Write unit tests for `RolesGuard` (admin access, viewer denial, multiple roles, no token)
- [x] 9.4 Write unit tests for `AdminSeedService` (first run creates admin, second run skips)
- [x] 9.5 Write integration/spec tests for `AuthModule` e2e with test database

## 10. Verification

- [x] 10.1 Run all tests: `bun run --cwd apps/nest test` (all passing)
- [x] 10.2 Manual smoke test: start app, register user, login, call `/auth/me` with token
- [x] 10.3 Verify admin seed runs on first startup

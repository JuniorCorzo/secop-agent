# Spec: auth-jwt

JWT-based authentication with login, registration, and token validation.

## ADDED Requirements

### Requirement: User Registration
The system SHALL allow new users to register with email and password.

#### Scenario: Successful registration with valid credentials
- **WHEN** a POST request is sent to `/auth/register` with `{"email": "user@example.com", "password": "securePass123"}`
- **THEN** the system creates a User with hashed password, assigns role `viewer`, and returns `{"access_token": "<jwt>", "user": {"id": "<uuid>", "email": "user@example.com", "role": "viewer"}}` with HTTP 201

#### Scenario: Registration with existing email
- **WHEN** a POST request is sent to `/auth/register` with an email that already exists
- **THEN** the system returns HTTP 409 with `{"message": "Email already registered", "statusCode": 409}`

#### Scenario: Registration with invalid email format
- **WHEN** a POST request is sent to `/auth/register` with `{"email": "not-an-email", "password": "securePass123"}`
- **THEN** the system returns HTTP 400 with validation error details

#### Scenario: Registration with short password
- **WHEN** a POST request is sent to `/auth/register` with `{"email": "user@example.com", "password": "123"}`
- **THEN** the system returns HTTP 400 indicating password minimum length (8 characters)

#### Scenario: Registration with attempted role escalation
- **WHEN** a POST request is sent to `/auth/register` with an extra `role` field such as `{"email": "user@example.com", "password": "securePass123", "role": "admin"}`
- **THEN** the system returns HTTP 400 because `role` is not an allowed registration field

### Requirement: User Login
The system SHALL authenticate users with email and password and return a JWT.

#### Scenario: Successful login with valid credentials
- **WHEN** a POST request is sent to `/auth/login` with `{"email": "admin@secop.com", "password": "correctPassword"}`
- **THEN** the system returns HTTP 200 with `{"access_token": "<jwt>", "user": {"id": "<uuid>", "email": "admin@secop.com", "role": "admin"}}`

#### Scenario: Login with wrong password
- **WHEN** a POST request is sent to `/auth/login` with correct email but wrong password
- **THEN** the system returns HTTP 401 with `{"message": "Invalid credentials", "statusCode": 401}`

#### Scenario: Login with non-existent email
- **WHEN** a POST request is sent to `/auth/login` with an email not in the database
- **THEN** the system returns HTTP 401 with `{"message": "Invalid credentials", "statusCode": 401}`

### Requirement: Current User Endpoint
The system SHALL return the authenticated user's profile from a valid JWT.

#### Scenario: Get current user with valid token
- **WHEN** a GET request is sent to `/auth/me` with a valid `Authorization: Bearer <jwt>` header
- **THEN** the system returns HTTP 200 with `{"id": "<uuid>", "email": "user@example.com", "role": "viewer"}`

#### Scenario: Get current user without token
- **WHEN** a GET request is sent to `/auth/me` without an Authorization header
- **THEN** the system returns HTTP 401 with `{"message": "Unauthorized", "statusCode": 401}`

#### Scenario: Get current user with expired token
- **WHEN** a GET request is sent to `/auth/me` with an expired JWT
- **THEN** the system returns HTTP 401 with `{"message": "Unauthorized", "statusCode": 401}`

### Requirement: JWT Token Validation
The system SHALL validate JWT tokens on protected routes, extracting the user from the token payload.

#### Scenario: Protected route with valid token
- **WHEN** a request is sent to any route protected by `JwtAuthGuard` with a valid JWT
- **THEN** the system extracts the user id from the token, reloads the user from the database, and makes the current DB-backed user available via `@CurrentUser()` decorator

#### Scenario: Protected route with tampered token
- **WHEN** a request is sent to a protected route with a JWT signed with a different secret
- **THEN** the system returns HTTP 401 with `{"message": "Unauthorized", "statusCode": 401}`

### Requirement: Password Security
The system SHALL hash passwords using bcrypt with 12 rounds before storing them.

#### Scenario: Password is hashed on registration
- **WHEN** a user registers with password `"MySecret123"`
- **THEN** the stored `password_hash` field in the database is NOT the plaintext `"MySecret123"` and is a valid bcrypt hash

#### Scenario: Auth response excludes password hash
- **WHEN** any auth endpoint returns user data (login, register, me)
- **THEN** the response SHALL NOT include the `password_hash` field

### Requirement: Admin User Seed
The system SHALL create a default admin user on first run if no admin exists.

#### Scenario: First run creates admin
- **WHEN** the application starts and no user with role `admin` exists in the database
- **THEN** the system creates and persists an admin `User` row in the database using the bootstrap admin credentials

#### Scenario: Admin already exists
- **WHEN** the application starts and an admin user already exists
- **THEN** the system does NOT create a duplicate admin user

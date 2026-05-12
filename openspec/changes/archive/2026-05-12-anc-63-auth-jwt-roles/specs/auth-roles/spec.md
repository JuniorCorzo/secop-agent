# Spec: auth-roles

Role-based authorization via `@Roles()` decorator and `RolesGuard`.

## ADDED Requirements

### Requirement: Role-Based Access Control
The system SHALL restrict endpoint access based on user roles using the `@Roles()` decorator.

#### Scenario: Admin accesses admin-only endpoint
- **WHEN** a user with role `admin` sends a request to an endpoint decorated with `@Roles('admin')`
- **THEN** the system allows access and processes the request normally

#### Scenario: Viewer denied access to admin endpoint
- **WHEN** a user with role `viewer` sends a request to an endpoint decorated with `@Roles('admin')`
- **THEN** the system returns HTTP 403 with `{"message": "Forbidden resource", "statusCode": 403}`

#### Scenario: Analista denied access to admin endpoint
- **WHEN** a user with role `analista` sends a request to an endpoint decorated with `@Roles('admin')`
- **THEN** the system returns HTTP 403 with `{"message": "Forbidden resource", "statusCode": 403}`

### Requirement: Multiple Role Support
The system SHALL allow endpoints to accept multiple roles via `@Roles('admin', 'analista')`.

#### Scenario: Admin accesses multi-role endpoint
- **WHEN** a user with role `admin` sends a request to an endpoint decorated with `@Roles('admin', 'analista')`
- **THEN** the system allows access

#### Scenario: Analista accesses multi-role endpoint
- **WHEN** a user with role `analista` sends a request to an endpoint decorated with `@Roles('admin', 'analista')`
- **THEN** the system allows access

#### Scenario: Viewer denied on multi-role endpoint
- **WHEN** a user with role `viewer` sends a request to an endpoint decorated with `@Roles('admin', 'analista')`
- **THEN** the system returns HTTP 403

### Requirement: Unauthenticated Requests on Role-Protected Routes
The system SHALL return 401 for unauthenticated requests before evaluating roles.

#### Scenario: No token on role-protected endpoint
- **WHEN** a request without an Authorization header is sent to an endpoint decorated with `@Roles('admin')`
- **THEN** the system returns HTTP 401 (not 403), because the user is not authenticated

### Requirement: User Role Enum
The system SHALL define a UserRole enum with values: `admin`, `analista`, `viewer`.

#### Scenario: Valid role assignment
- **WHEN** a User entity is created with `role = 'analista'`
- **THEN** the value is accepted and stored correctly

#### Scenario: Invalid role assignment throws error
- **WHEN** a User entity is created with an invalid role like `'superadmin'`
- **THEN** the system rejects it with a validation error

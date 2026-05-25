# company-profile Specification

## Purpose
TBD - created by archiving change anc-70-companies-module. Update Purpose after archive.
## Requirements
### Requirement: Registro de Perfil de Empresa
El sistema DEBE permitir el registro de una nueva empresa con NIT, razón social, ubicación (ciudad/departamento) y sectores de actividad.

#### Scenario: Creación exitosa de empresa
- **WHEN** se envía una petición POST a `/companies` con NIT, razón social y ubicación válida.
- **THEN** el sistema crea el registro en la base de datos y retorna el objeto creado con un ID único.

#### Scenario: Intento de registro con NIT duplicado
- **WHEN** se envía una petición POST a `/companies` con un NIT que ya existe en el sistema.
- **THEN** el sistema retorna un error 409 (Conflict).

### Requirement: Consulta de Perfiles de Empresa
El sistema DEBE permitir listar y consultar el detalle de las empresas registradas.

#### Scenario: Listado de empresas
- **WHEN** se envía una petición GET a `/companies`.
- **THEN** el sistema retorna un arreglo con todas las empresas registradas.

#### Scenario: Consulta de detalle por ID
- **WHEN** se envía una petición GET a `/companies/:id`.
- **THEN** el sistema retorna los datos completos de la empresa correspondiente.


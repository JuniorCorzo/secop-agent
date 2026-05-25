# company-capacity Specification

## Purpose
TBD - created by archiving change anc-70-companies-module. Update Purpose after archive.
## Requirements
### Requirement: Gestión de Capacidad Financiera
El sistema DEBE permitir almacenar y actualizar los indicadores financieros de una empresa (Liquidez, Endeudamiento, Razón de Cobertura de Intereses).

#### Scenario: Actualización de indicadores financieros
- **WHEN** se envía una petición PATCH a `/companies/:id` con nuevos valores para los indicadores financieros.
- **THEN** el sistema actualiza los valores y retorna el registro actualizado.

### Requirement: Gestión de Capacidad Técnica y Organizacional
El sistema DEBE permitir almacenar datos de experiencia y capacidad organizacional (K de contratación).

#### Scenario: Registro de K de contratación
- **WHEN** se actualiza el perfil de una empresa con un valor para `contractingCapacity`.
- **THEN** el sistema persiste el valor como un número decimal.


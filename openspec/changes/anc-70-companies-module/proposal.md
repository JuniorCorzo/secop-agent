## Why

La plataforma SECOP Agent requiere un sistema para gestionar perfiles de empresas (licitadores). Esto es fundamental para permitir que los usuarios filtren y califiquen (scoring) las convocatorias de contratación pública colombiana basándose en la idoneidad, ubicación geográfica y capacidad financiera/operativa de sus propias empresas o de sus competidores. Actualmente, el módulo `CompaniesModule` es solo un placeholder vacío.

## What Changes

- **Implementación del CompaniesModule**: Se graduará el placeholder de `apps/nest/src/modules/companies/` a un módulo funcional.
- **Entidad Company**: Creación de la entidad principal con soporte para:
    - Información básica (NIT, Razón Social).
    - Sectores de interés (basados en códigos UNSPSC o categorías SECOP).
    - Cobertura geográfica (Regiones/Departamentos).
    - Indicadores de capacidad (Financiera, Organizacional, Experiencia).
- **API REST**: Endpoints para CRUD básico de perfiles de empresa.
- **Persistencia**: Migración de base de datos para la tabla `companies` y sus relaciones.

## Capabilities

### New Capabilities
- `company-profile`: Gestión de la información básica, ubicación y sectores de actividad de las empresas.
- `company-capacity`: Definición y seguimiento de métricas de capacidad financiera y técnica para procesos de licitación.

### Modified Capabilities
- Ninguna.

## Impact

- **Backend**: Desarrollo en `apps/nest/src/modules/companies/`.
- **Base de Datos**: Nueva migración en `apps/nest/src/migrations/` para la tabla `companies`.
- **API**: Nuevos endpoints bajo el prefijo `/companies`.

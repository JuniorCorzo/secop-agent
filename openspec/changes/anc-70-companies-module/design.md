## Context

El sistema SECOP Agent está diseñado para analizar licitaciones públicas. Para que el análisis sea efectivo, el sistema debe conocer el perfil de la empresa que está realizando la búsqueda (o de sus competidores). Actualmente existe un `CompaniesModule` en `apps/nest/src/modules/companies/` que no tiene implementación.

## Goals / Non-Goals

**Goals:**
- Definir el esquema de datos para perfiles de empresas.
- Implementar la persistencia mediante TypeORM y PostgreSQL.
- Exponer una API REST básica para la gestión de estos perfiles.
- Soportar la categorización por sectores (UNSPSC) y ubicación geográfica.

**Non-Goals:**
- Implementar lógica compleja de scoring (esto pertenece a `ScoringModule`).
- Integración con APIs externas de validación de empresas (RUES, etc.) en esta fase.
- Interfaz de usuario (ANC-70 es un requerimiento de backend/datos).

## Decisions

### 1. Modelado de Sectores y Regiones
**Decisión**: Usar arreglos de texto (`text[]`) en PostgreSQL para los campos `sectors` (códigos UNSPSC) y `regions` (nombres de departamentos/ciudades).
**Razón**: Facilita búsquedas rápidas mediante operadores de arreglos de Postgres y evita la complejidad de tablas relacionales adicionales para catálogos que son mayormente estáticos o referenciales en esta etapa.

### 2. Estructura de Capacidad
**Decisión**: Incluir campos numéricos directos para indicadores financieros comunes (Liquidez, Endeudamiento, Razón de Cobertura de Intereses) y capacidad de contratación (K de contratación).
**Razón**: Estos datos son los que SECOP utiliza para habilitar proponentes; tenerlos estructurados permite comparaciones directas con los requisitos de las licitaciones.

### 3. Service Pattern
**Decisión**: Seguir el patrón de repositorio inyectado en un servicio de dominio, siguiendo las convenciones de NestJS del proyecto.

## Risks / Trade-offs

- **[Riesgo]** El uso de `text[]` para sectores puede dificultar la integridad referencial si luego se requiere un catálogo maestro estricto.
- **[Mitigación]** Validar los códigos en el DTO antes de la persistencia.
- **[Trade-off]** Se prioriza la velocidad de desarrollo y simplicidad de consultas sobre la normalización exhaustiva de los sectores/regiones.

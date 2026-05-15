## Why

El backend NestJS necesita ingestar datos de SECOP directamente desde la API SODA 3.0, sin depender de Hermes como intermediario. Los datasets son datos estructurados con schema fijo (SECOP-I: 79 columnas, SECOP-II: 59 columnas), por lo que la normalización es un mapeo determinístico estático — no requiere IA ni procesamiento semántico.

Hermes queda fuera del pipeline de ingesta. El scheduler vive dentro de NestJS.

## What Changes

- Implementar `SodaIngestionService` en NestJS que consulta SECOP-I (`f789-7hwg`) y SECOP-II (`p6dx-8zbt`) vía SODA 3.0
- Scheduler interno con `@nestjs/schedule` cada 6 horas
- Paginación con `pageSize: 5000` iterando hasta agotar resultados por dataset
- Mapeo estático SODA → `ProcurementNoticeDto` por dataset (sin IA):
  - SECOP-I: 79 columnas con schema `f789-7hwg`
  - SECOP-II: 59 columnas con schema `p6dx-8zbt`
- Upsert directo a PostgreSQL vía `ProcurementNoticesService.bulkUpsert()`
- Reintentos con backoff exponencial por dataset (independientes entre sí)
- Variables de entorno: `SODA_API_URL`, `SODA_APP_TOKEN`, `SODA_DATASET_SECOP1`, `SODA_DATASET_SECOP2`

## Capabilities

### New Capabilities

- `soda-ingestion`: Scheduler interno NestJS que consulta SECOP-I y SECOP-II vía SODA 3.0, pagina resultados, aplica mapeo estático de campos y persiste directamente en PostgreSQL

### Modified Capabilities

- `hybrid-ingestion`: La ingesta ya no depende de Hermes. NestJS es el único actor del pipeline de ingesta. El endpoint `POST /procurement-notices/bulk` sigue disponible para ingestas manuales o externas.

## Impact

- **NestJS**: nuevo `SodaIngestionModule` con service + scheduler + mappers
- **Hermes**: eliminado del pipeline de ingesta (puede seguir existiendo para otras tareas)
- **Env vars**: `SODA_DATASET_SECOP1`, `SODA_DATASET_SECOP2`, `SODA_APP_TOKEN` en `.env.example`
- **No breaking changes en el endpoint** `/procurement-notices/bulk` — sigue disponible

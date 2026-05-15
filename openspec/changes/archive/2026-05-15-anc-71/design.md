## Context

El backend NestJS asume la responsabilidad de ingestar datos SECOP directamente desde la API SODA 3.0. Hermes queda fuera del pipeline de ingesta. El scheduler vive dentro de NestJS usando `@nestjs/schedule` + BullMQ para el procesamiento asíncrono de lotes.

Los datasets son estructurados con schema fijo. La normalización es ETL puro — mapeo estático de campos, sin IA.

## Goals / Non-Goals

**Goals:**
- Scheduler interno NestJS que consulta SECOP-I y SECOP-II cada 6 horas
- Paginación exhaustiva con `pageSize: 5000` por dataset
- Mappers estáticos SODA → `ProcurementNoticeDto` para cada dataset
- Upsert directo vía `ProcurementNoticesService.bulkUpsert()`
- Reintentos con backoff exponencial por dataset (independientes)
- Env vars: `SODA_API_URL`, `SODA_APP_TOKEN`, `SODA_DATASET_SECOP1`, `SODA_DATASET_SECOP2`

**Non-Goals:**
- Lógica de scoring o enriquecimiento (módulos futuros)
- Autenticación del scheduler con el backend (es interno, no necesita JWT)
- Migración de datos históricos (ingesta incremental por `$where` en SODA)
- Hermes como parte del pipeline de ingesta

## Architecture

```
@nestjs/schedule (cron: cada 6h)
        │
        ▼
SodaIngestionService.runIngestionCycle()
        │
        ├─── fetchAndIngest(SECOP_I)  ─┐
        │                              ├── paralelo (Promise.allSettled)
        └─── fetchAndIngest(SECOP_II) ─┘
                    │
                    ▼
        SodaClient.paginateDataset()
          └── GET SODA 3.0 API (paginado)
                    │
                    ▼
        SecopMapper.map(raw, source)
          └── mapeo estático por dataset
                    │
                    ▼
        ProcurementNoticesService.bulkUpsert()
          └── upsert en chunks de 500 → PostgreSQL
```

## Module Structure

```
modules/soda-ingestion/
├── soda-ingestion.module.ts
├── services/
│   ├── soda-ingestion.service.ts     # Scheduler + orquestación del ciclo
│   └── soda-client.service.ts        # HTTP client SODA 3.0 con paginación y reintentos
├── mappers/
│   ├── secop-i.mapper.ts             # SODA f789-7hwg → ProcurementNoticeDto
│   └── secop-ii.mapper.ts            # SODA p6dx-8zbt → ProcurementNoticeDto
└── soda-ingestion.types.ts           # Enums, interfaces de raw SODA response
```

## Decisions

### D1: `@nestjs/schedule` + BullMQ vs solo `@nestjs/schedule`

**Decisión:** `@nestjs/schedule` dispara el ciclo. El procesamiento de cada página se encola en BullMQ (`soda-ingestion-queue`) para no bloquear el event loop durante la paginación de 15M registros.

**Rationale:** Paginar 15M registros en el mismo hilo bloquearía el servidor. BullMQ ya está configurado en el proyecto. El worker procesa lotes de 500 registros de forma asíncrona.

**Alternativa descartada:** Solo `@nestjs/schedule` con `async/await` — funciona para datasets pequeños pero es riesgoso con 6-8M registros por dataset.

### D2: `Promise.allSettled` vs `Promise.all` para datasets paralelos

**Decisión:** `Promise.allSettled` para lanzar SECOP-I y SECOP-II en paralelo.

**Rationale:** `Promise.all` cancela todo si uno falla. Con `allSettled`, el fallo de SECOP-I no interrumpe SECOP-II. Cada dataset es independiente.

### D3: `pageSize: 5000` vs `50000`

**Decisión:** `pageSize: 5000`.

**Rationale:** SODA 3.0 tiene límites de timeout por request. Con 50000 registros por página y campos de texto largo, los requests pueden superar 30s. 5000 es más seguro y permite reintentos granulares sin perder mucho trabajo.

### D4: Ingesta incremental vs full scan

**Decisión:** Incremental por defecto usando `$where=fecha_de_ultima_publicaci > '${lastRunTimestamp}'` en SODA. Full scan solo en primera ejecución o cuando se fuerza via endpoint.

**Rationale:** Con 15M registros históricos, un full scan cada 6h es innecesario y costoso en tiempo. Solo los registros actualizados desde el último ciclo son relevantes.

### D5: Mappers como clases vs funciones puras

**Decisión:** Funciones puras exportadas desde archivos de mapper.

**Rationale:** Los mappers no tienen estado ni dependencias inyectables. Funciones puras son más simples, testeables y alineadas con KISS.

## Risks / Trade-offs

- **[Risk] Rate limiting SODA** → Mitigation: `X-App-Token` obligatorio. Backoff exponencial (1s, 2s, 4s) en reintentos. Máximo 2 requests concurrentes por dataset.
- **[Risk] Schema drift entre datasets** → Mitigation: Mappers con campos opcionales y `null` como fallback. Tests con fixtures reales de SODA.
- **[Risk] Ciclo largo bloquea el siguiente** → Mitigation: Guard en el scheduler — si el ciclo anterior sigue corriendo, el nuevo se saltea con log WARNING.

## Environment Variables

```bash
SODA_API_URL=https://www.datos.gov.co
SODA_APP_TOKEN=<token>
SODA_DATASET_SECOP1=f789-7hwg
SODA_DATASET_SECOP2=p6dx-8zbt
SODA_PAGE_SIZE=5000          # opcional, default 5000
SODA_CRON=0 */6 * * *        # opcional, default cada 6h
```

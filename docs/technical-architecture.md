# Technical Architecture: Plataforma Licitaciones SECOP

Este documento proporciona una visión en profundidad de la arquitectura técnica, utilizando diagramas para visualizar las interacciones de los componentes y el flujo de datos. Está basado en los principios descritos en `ARCHITECTURED.md` y `AGENTS.md`.

## 1. System Architecture Overview

La plataforma sigue una arquitectura basada en monorepositorio con backend en NestJS y frontend en React, usando colas y workers sandboxed para cargas asíncronas pesadas (ej. ingestión de SODA).

```mermaid
graph TD
    subgraph Frontend ["Frontend (apps/web)"]
        ReactUI["React 19 + Vite 6 + TailwindCSS"]
    end

    subgraph Backend ["Backend (apps/nest)"]
        NestAPI["NestJS API (TypeScript)"]
        AuthModule["Auth Module (JWT)"]
        ProcurementModule["Procurement Notices Module"]
        IngestionModule["SODA Ingestion Module"]
        QueueModule["Queues Module (BullMQ)"]

        NestAPI --> AuthModule
        NestAPI --> ProcurementModule
        NestAPI --> IngestionModule
        NestAPI --> QueueModule
    end

    subgraph Infrastructure ["Infrastructure"]
        PostgresDB[("PostgreSQL 16\n(+pgvector)")]
        RedisCache[("Redis 7\n(Cache & BullMQ)")]
        Worker["Bun Worker Thread\n(Sandboxed Processor)"]
    end

    subgraph External ["External Services"]
        SodaAPI["SODA 3.0 API\n(datos.gov.co)"]
    end

    ReactUI -- "REST API" --> NestAPI
    IngestionModule -- "Fetch Stream" --> SodaAPI
    QueueModule -- "Enqueue Jobs" --> RedisCache
    Worker -- "Consume Jobs" --> RedisCache
    Worker -- "Upsert Data" --> PostgresDB
    NestAPI -- "Read/Write" --> PostgresDB
```

## 2. Flujo de Datos SODA Ingestion

El flujo de ingestión recupera grandes volúmenes de datos (~21.8M registros) desde la API de SODA utilizando paginación por cursor y encolando en micro-batches, todo manejado por procesadores en sandbox para evitar bloquear el event loop principal de NestJS.

```mermaid
sequenceDiagram
    participant Cron as Cron/Bootstrap (NestJS)
    participant SodaSvc as SodaIngestionService
    participant SODA as SODA 3.0 API
    participant BullMQ as BullMQ Queue (Redis)
    participant Worker as Bun Worker (Sandboxed)
    participant DB as PostgreSQL

    Cron->>SodaSvc: Iniciar Ciclo de Ingestión
    loop Paginación por Cursor
        SodaSvc->>SODA: fetchPageCursor ($where, $order)
        SODA-->>SodaSvc: Página de resultados
        SodaSvc->>SodaSvc: Mapeo DTO & Filtrar CANCELLED/REJECTED
        SodaSvc->>SodaSvc: Acumular micro-batch (1000 items)
        SodaSvc->>BullMQ: Encolar Trabajo de Ingestión (batch)
    end

    BullMQ-->>Worker: Notificar nuevo trabajo
    Worker->>Worker: Deduplicación (Set/Map local)
    Worker->>DB: upsert (chunks de 5000)
    Worker-->>BullMQ: Job completado
```

## 3. Flujo de Ciclo de Vida de Procurement Notices

Los registros de SECOP ("Procurement Notices") transitan a través de diferentes estados en el sistema.

```mermaid
stateDiagram-v2
    [*] --> PENDING: Ingestión inicial (Si no es CANCELLED/REJECTED)
    PENDING --> ENRICHING: Cola de Procesamiento/Enriquecimiento
    ENRICHING --> SCORING: Asignación de Puntuación (Scoring Engine)
    SCORING --> AWARDED: Licitación Finalizada (Adjudicada)
    SCORING --> REJECTED: Licitación Rechazada
    SCORING --> CANCELLED: Licitación Cancelada

    note right of PENDING: Nota: CANCELLED y REJECTED en SODA \n son filtrados durante la ingestión y no persisten.
```

## 4. Estructura de Módulos (Backend)

Cada módulo en NestJS está autocontenido y respeta las responsabilidades de separación:

```mermaid
graph LR
    subgraph FeatureModule ["Feature Module (e.g. ProcurementNotices)"]
        Controller["Controller\n(Routes, DTO Binding)"]
        Service["Service\n(Business Logic, HTTP Exceptions)"]
        Repository["Entity Repository\n(TypeORM, QueryBuilder)"]
        DTO["DTOs\n(class-validator)"]

        Controller --> Service
        Controller --> DTO
        Service --> Repository
    end
```

## Referencias

- Principios de desarrollo: [CONVENTIONS.md](../CONVENTIONS.md)
- Arquitectura en detalle: [ARCHITECTURED.md](../ARCHITECTURED.md)
- Directrices para Agentes: [AGENTS.md](../AGENTS.md)

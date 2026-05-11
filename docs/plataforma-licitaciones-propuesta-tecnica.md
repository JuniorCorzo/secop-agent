# Propuesta Técnica: Plataforma de Análisis y Recomendación de Licitaciones SECOP

> **Versión:** 1.0 — Borrador de Arquitectura
> **Rol objetivo:** Arquitecto de Solución / Engineering Lead
> **Stack:** NestJS · PostgreSQL + pgvector · Hermes · OpenCode Go · RAG Híbrido

---

## Tabla de Contenidos

1. [Descripción Técnica del Problema](#1-descripción-técnica-del-problema)
2. [Objetivos Funcionales y No Funcionales](#2-objetivos-funcionales-y-no-funcionales)
3. [Principios de Diseño Arquitectónico](#3-principios-de-diseño-arquitectónico)
4. [Arquitectura General del Sistema](#4-arquitectura-general-del-sistema)
5. [Justificación de NestJS como Backend Principal](#5-justificación-de-nestjs-como-backend-principal)
6. [Justificación de Hermes como Capa de Automatización](#6-justificación-de-hermes-como-capa-de-automatización)
7. [Justificación del Proveedor de IA Desacoplado](#7-justificación-del-proveedor-de-ia-desacoplado)
8. [Diseño por Módulos del Backend](#8-diseño-por-módulos-del-backend)
9. [Pipeline de Ingesta de Convocatorias](#9-pipeline-de-ingesta-de-convocatorias)
10. [Pipeline de Normalización Documental](#10-pipeline-de-normalización-documental)
11. [Diseño del RAG](#11-diseño-del-rag)
12. [Diseño del Scoring de Viabilidad](#12-diseño-del-scoring-de-viabilidad)
13. [Diseño del Análisis de Competencia](#13-diseño-del-análisis-de-competencia)
14. [Diseño de Alertas y Notificaciones](#14-diseño-de-alertas-y-notificaciones)
15. [Diseño de Integración Frontend-Backend](#15-diseño-de-integración-frontend-backend)
16. [Diseño de Trazabilidad, Auditoría y Observabilidad](#16-diseño-de-trazabilidad-auditoría-y-observabilidad)
17. [Modelo de Datos Sugerido](#17-modelo-de-datos-sugerido)
18. [Estrategia de Persistencia](#18-estrategia-de-persistencia)
19. [Estrategia de Extracción desde SECOP](#19-estrategia-de-extracción-desde-secop)
20. [Hermes vs NestJS: División de Responsabilidades](#20-hermes-vs-nestjs-división-de-responsabilidades)
21. [Riesgos Técnicos y Mitigaciones](#21-riesgos-técnicos-y-mitigaciones)
22. [Fases de Implementación](#22-fases-de-implementación)
23. [MVP Sugerido](#23-mvp-sugerido)
24. [Evoluciones Futuras](#24-evoluciones-futuras)

---

## 1. Descripción Técnica del Problema

### 1.1 El dominio

SECOP (Sistema Electrónico de Contratación Pública) es el ecosistema de contratación estatal colombiano. Opera en dos plataformas —SECOP I y SECOP II— y expone datos abiertos a través del portal datos.gov.co, que corre sobre Socrata/Tyler Technologies con API SODA 3.0.

El dataset `SECOP Integrado` contiene ~21.8 millones de registros históricos de procesos de contratación. De estos, aproximadamente 970 mil estuvieron en estado `Convocado` en algún momento. Los procesos activos en un momento dado son una fracción menor.

### 1.2 El problema real (no el obvious problem)

El problema no es "hay muchos datos". El problema es de **señal versus ruido**:

1. **Volumen:** Una empresa no puede revisar manualmente cientos de convocatorias abiertas.
2. **Ambigüedad:** El campo `objeto_a_contratar` es texto libre, sin taxonomía. El mismo servicio puede describirse de 20 formas distintas.
3. **Documentación dispersa:** Los pliegos, adendas, estudios previos y requisitos están en formatos no estructurados (PDF, DOCX, HTML) alojados en URLs externas.
4. **Contexto faltante:** Una convocatoria no dice "esta entidad suele adjudicar al mismo proveedor" ni "tus competidores directos ya participaron en procesos similares 15 veces".
5. **Evaluación multidimensional:** La viabilidad no es binaria. Depende de capacidad técnica, financiera, experiencia, competencia, riesgo del proceso, y alineación estratégica.
6. **Explicabilidad:** Un score sin explicación no sirve. La empresa necesita saber **por qué** algo es viable o no.

### 1.3 Lo que no resuelve un LLM solo

Un LLM genérico no puede:
- Consultar 21.8M de registros y agregarlos
- Mantener estado entre ejecuciones
- Garantizar auditabilidad
- Aplicar reglas de negocio determinísticas (filtros duros)
- Operar sin un RAG diseñado para este dominio

La solución requiere un sistema híbrido: backend estructurado + automatización externa + RAG + scoring determinístico + IA como asistente, no como decisor.

---

## 2. Objetivos Funcionales y No Funcionales

### 2.1 Funcionales

| ID | Objetivo | Prioridad |
|----|----------|-----------|
| OF-01 | Consultar convocatorias abiertas de SECOP vía API SODA 3.0 | P0 |
| OF-02 | Clasificar convocatorias por sector mediante reglas de keywords | P0 |
| OF-03 | Mantener un catálogo de empresas con perfil, capacidad, experiencia | P0 |
| OF-04 | Calcular score de viabilidad (0-100) para cada par empresa-convocatoria | P0 |
| OF-05 | Generar explicación textual de cada recomendación | P0 |
| OF-06 | Analizar competidores históricos para una convocatoria | P1 |
| OF-07 | Construir y consultar RAG sobre documentos de soporte | P1 |
| OF-08 | Indexar pliegos y documentos de convocatorias en el RAG | P1 |
| OF-09 | Enviar alertas por correo ante nuevas convocatorias relevantes | P1 |
| OF-10 | Dashboard web con convocatorias, scores, y análisis | P0 |
| OF-11 | Permitir retroalimentación del usuario (viable/no viable) para refinar | P2 |

### 2.2 No Funcionales

| ID | Objetivo | Meta |
|----|----------|------|
| ONF-01 | **Auditabilidad:** Todo score debe ser trazable a sus variables | 100% de decisiones explicables |
| ONF-02 | **Desacoplamiento de IA:** Cambiar de proveedor no debe requerir refactor | Abstracción `LlmProvider` |
| ONF-03 | **Separación de concerns:** NestJS = lógica de negocio, Hermes = automatización | Sin lógica de negocio en scripts |
| ONF-04 | **Resiliencia:** Fallo de API externa no debe corromper datos | Circuit breaker + reintentos |
| ONF-05 | **Performance:** Scores para una empresa vs 500 convocatorias | < 60 segundos |
| ONF-06 | **Seguridad:** API Keys y tokens nunca en logs ni código | Secrets manager |
| ONF-07 | **Extensibilidad:** Nuevos sectores, reglas, o filtros sin redeploy completo | Configuración externa |

---

## 3. Principios de Diseño Arquitectónico

1. **Reglas de negocio en el backend, no en el agente.** NestJS es el dueño de la lógica. Hermes ejecuta tareas.
2. **IA como asistente, no como decisor.** El scoring es determinístico. La IA explica, resume, y asiste en clasificación ambigua.
3. **RAG híbrido.** Combinar búsqueda semántica con filtros estructurados. El RAG no decide — aporta evidencia.
4. **Proveedor de IA intercambiable.** Abstracción `LlmProvider` con implementaciones concretas.
5. **Todo score es auditable.** Cada número del score se descompone en sus variables. Trazabilidad completa.
6. **Ingesta declarativa.** Pipelines bien definidos, con estados, reintentos, y logs.
7. **Hermes como worker externo.** sin lógica de dominio. Solo ejecuta tareas que recibe.
8. **API-first.** Toda funcionalidad expuesta vía REST/SSE. Frontend es un consumidor más.

---

## 4. Arquitectura General del Sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/Vue)                         │
│  Dashboard │ Convocatorias │ Scores │ Competencia │ Perfil Empresa   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ REST + SSE
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     NESTJS BACKEND (API Gateway)                     │
│                                                                      │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Auth      │ │Convocator │ │Company   │ │Scoring   │ │Competitor│ │
│  │Module    │ │Module     │ │Module    │ │Module    │ │Module    │ │
│  └──────────┘ └───────────┘ └──────────┘ └──────────┘ └──────────┘ │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Alert     │ │Document   │ │RAG       │ │LLM       │ │Audit     │ │
│  │Module    │ │Module     │ │Module    │ │Module    │ │Module    │ │
│  └──────────┘ └───────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    CORE SERVICES                              │   │
│  │  ScoringEngine │ SectorClassifier │ CompetitorAnalyzer        │   │
│  │  DocumentIngester │ RagService │ NotificationService         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│  PostgreSQL  │  │  pgvector    │  │  File Storage    │
│  (datos      │  │  (embeddings │  │  (PDFs, DOCX,    │
│   estruct.)  │  │   RAG)       │  │   pliegos)       │
└──────────────┘  └──────────────┘  └──────────────────┘
          ▲                 ▲                  ▲
          │                 │                  │
┌─────────────────────────────────────────────────────────────────────┐
│                         HERMES (Automatización)                      │
│                                                                      │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐          │
│  │ SECOP Fetcher  │ │ Doc Downloader │ │ Alert Dispatcher│          │
│  │ (scheduled)    │ │ (on-demand)    │ │ (scheduled)    │          │
│  └────────────────┘ └────────────────┘ └────────────────┘          │
│  ┌────────────────┐ ┌────────────────┐                               │
│  │ Web Scraper    │ │ RAG Ingester   │                               │
│  │ (fallback)     │ │ (batch)        │                               │
│  └────────────────┘ └────────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ SODA API 3.0 │  │ SECOP Web    │  │ SMTP / Email │
│ datos.gov.co │  │ (contratos)  │  │ API          │
└──────────────┘  └──────────────┘  └──────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       OPENCODE GO (IA)                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                 │
│  │ LLM Provider │ │ Embeddings   │ │ Summarizer   │                 │
│  │ (chat/comp)  │ │ Generator    │ │ (RAG)        │                 │
│  └──────────────┘ └──────────────┘ └──────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Flujo de alto nivel

1. **Hermes** ejecuta búsqueda periódica de convocatorias abiertas vía SODA API 3.0 (o scraping si es necesario).
2. Los resultados se envían a **NestJS** vía API REST (`POST /convocatorias/bulk`).
3. **NestJS** clasifica, normaliza, y persiste. Si hay documentos (pliegos), notifica a Hermes para descarga.
4. **Hermes** descarga documentos, los envía a NestJS (`POST /documentos`).
5. **NestJS** fragmenta, genera embeddings (vía OpenCode Go), y los indexa en pgvector.
6. Cuando un usuario consulta, **NestJS** ejecuta el pipeline de scoring que combina reglas + RAG + análisis de competencia.
7. El score se desglosa y se explica con evidencias del RAG y datos históricos.
8. **Hermes** envía alertas programadas por correo con las novedades del día.

---

## 5. Justificación de NestJS como Backend Principal

### Por qué NestJS — no Express crudo, no Fastify, no Python

| Criterio | NestJS | Alternativas | Veredicto |
|----------|--------|-------------|-----------|
| **Experiencia del equipo** | Conocido por el usuario | — | ✅ Ventaja crítica |
| **Tipado estricto** | TypeScript nativo, decorators, DTOs | Fastify (JS), Django (Python) | ✅ Menos errores en datos financieros |
| **Arquitectura modular** | Modules, Providers, Inyectables | Express requiere manual | ✅ Escala con complejidad |
| **Inyección de dependencias** | Nativo y maduro | Fastify con awilix, Django built-in | ✅ Testing más fácil |
| **Guardas e interceptores** | Decorators para auth, logging, cache | Manual en otros | ✅ Auditoría transversal sin boilerplate |
| **Microservicios** | Transport layer nativo (TCP, Redis, gRPC) | — | ✅ Preparado si Hermes escala |
| **OpenAPI/Swagger** | `@nestjs/swagger` genera docs automático | — | ✅ Frontend se autodocumenta |
| **Queue nativo** | `@nestjs/bull` para BullMQ | — | ✅ Pipelines de ingesta asíncronos |
| **SSE nativo** | `@nestjs/common` → `@Sse()` | — | ✅ Para streaming de scores en tiempo real |

### Patrones NestJS que aprovechamos

```typescript
// Ejemplo: Abstracción de proveedor de IA con DI
export interface LlmProvider {
  chat(messages: ChatMessage[]): Promise<string>;
  embed(text: string): Promise<number[]>;
}

@Injectable()
export class OpenCodeGoProvider implements LlmProvider {
  constructor(private readonly httpService: HttpService) {}
  // ...
}

@Module({
  providers: [
    { provide: 'LlmProvider', useClass: OpenCodeGoProvider }
  ],
  exports: ['LlmProvider']
})
export class LlmModule {}
```

Esto permite cambiar de OpenCode Go a OpenAI, Anthropic, o un modelo local **sin tocar una línea del código de negocio**.

---

## 6. Justificación de Hermes como Capa de Automatización

### ¿Por qué no hacerlo todo en NestJS?

NestJS es excelente como API server y para lógica de negocio. Pero para tareas de automatización recurrente, hay ventajas en un componente externo:

| Tarea | En NestJS | En Hermes | Ganador |
|-------|-----------|-----------|---------|
| Cron jobs (cada N horas) | `@nestjs/schedule` | Nativo | Hermes — más robusto para scheduling |
| Navegación web / scraping | Puppeteer/Playwright en proceso Node | Nativo | Hermes — no bloquea el event loop |
| Descarga masiva de PDFs | Streams en Node | Paralelismo nativo | Hermes — más eficiente |
| Reintentos con backoff | Manual con BullMQ | Nativo | Empate |
| Envío de correos | Nodemailer | Nativo | Hermes — ya tiene integraciones |
| Lógica de negocio | ✅ Nativo | ❌ No debe | NestJS |

### Principio: Hermes ejecuta, NestJS decide

```
┌─────────┐  "busca convocatorias de salud en Antioquia"  ┌──────────┐
│ NestJS  │ ─────────────────────────────────────────────▶ │  Hermes  │
│ (decide)│                                               │ (ejecuta)│
└─────────┘                                               └──────────┘
     ▲                                                          │
     │  ["resultados JSON normalizados"]                        │
     └──────────────────────────────────────────────────────────┘
```

NestJS **nunca** le dice a Hermes "decidí si esta convocatoria es viable". Le dice "buscá convocatorias con estos filtros", "descargá estos documentos", "enviá este correo".

---

## 7. Justificación del Proveedor de IA Desacoplado

### El problema del vendor lock-in

Atarse a un solo proveedor de IA es un riesgo arquitectónico:
- Cambios de pricing
- Deprecación de modelos
- Límites de rate
- Necesidad de privacidad (modelo local)
- Mejores modelos en otros proveedores

### La abstracción

```typescript
// llm-provider.interface.ts
export interface LlmProvider {
  /** Chat completion: prompt → respuesta estructurada o libre */
  chat(options: ChatOptions): Promise<ChatResponse>;

  /** Generación de embeddings para RAG */
  embed(texts: string[]): Promise<number[][]>;

  /** Health check del proveedor */
  health(): Promise<boolean>;
}

export interface ChatOptions {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  jsonSchema?: object; // Para structured outputs
}
```

### Implementaciones concretas

```
LlmProvider (interface)
  ├── OpenCodeGoProvider      ← Actual
  ├── OpenAIProvider           ← Futuro (si cambian)
  ├── AnthropicProvider        ← Futuro
  └── LocalLlmProvider         ← Futuro (Ollama, vLLM)
```

### Dónde se usa la IA (y dónde NO)

| Caso de uso | ¿IA? | Justificación |
|-------------|------|---------------|
| Clasificar sector de una convocatoria | ✅ Sí | NLP sobre texto libre ambiguo |
| Extraer requisitos de un pliego PDF | ✅ Sí | Visión + NLP sobre docs no estructurados |
| Generar resumen ejecutivo de convocatoria | ✅ Sí | Summarization |
| Explicar por qué un score es alto/bajo | ✅ Sí | NLG con contexto del RAG |
| Calcular el score numérico | ❌ No | Determinístico, auditable, repetible |
| Aplicar filtros duros | ❌ No | Reglas de negocio, no IA |
| Consultar competidores | ❌ No | SQL sobre datos estructurados |
| Enviar alertas | ❌ No | Lógica de scheduling |

---

## 8. Diseño por Módulos del Backend

### 8.1 Mapa de módulos NestJS

```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   │   ├── audit.interceptor.ts
│   │   ├── timeout.interceptor.ts
│   │   └── circuit-breaker.interceptor.ts
│   └── pipes/
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   └── auth.service.ts
│   ├── convocatorias/
│   │   ├── convocatorias.module.ts
│   │   ├── convocatorias.controller.ts
│   │   ├── convocatorias.service.ts
│   │   ├── dto/
│   │   │   ├── create-convocatoria.dto.ts
│   │   │   └── query-convocatoria.dto.ts
│   │   └── entities/
│   │       └── convocatoria.entity.ts
│   ├── companies/
│   │   ├── companies.module.ts
│   │   ├── companies.controller.ts
│   │   ├── companies.service.ts
│   │   └── entities/
│   │       └── company.entity.ts
│   ├── scoring/
│   │   ├── scoring.module.ts
│   │   ├── scoring.controller.ts
│   │   ├── scoring.service.ts
│   │   ├── scoring-engine.service.ts    ← El corazón
│   │   ├── filters/
│   │   │   └── hard-filters.service.ts
│   │   ├── variables/
│   │   │   ├── technical-fit.calc.ts
│   │   │   ├── economic-fit.calc.ts
│   │   │   ├── experience-fit.calc.ts
│   │   │   ├── process-risk.calc.ts
│   │   │   └── competitive-pressure.calc.ts
│   │   └── explainer/
│   │       └── score-explainer.service.ts
│   ├── competitors/
│   │   ├── competitors.module.ts
│   │   ├── competitors.service.ts
│   │   └── competitor-analyzer.service.ts
│   ├── rag/
│   │   ├── rag.module.ts
│   │   ├── rag.controller.ts
│   │   ├── rag.service.ts
│   │   ├── chunker.service.ts
│   │   ├── embedder.service.ts
│   │   └── retriever.service.ts
│   ├── documents/
│   │   ├── documents.module.ts
│   │   ├── documents.controller.ts
│   │   ├── documents.service.ts
│   │   └── parsers/
│   │       ├── pdf-parser.service.ts
│   │       └── docx-parser.service.ts
│   ├── llm/
│   │   ├── llm.module.ts
│   │   ├── llm.service.ts
│   │   └── providers/
│   │       ├── llm-provider.interface.ts
│   │       └── opencode-go.provider.ts
│   ├── alerts/
│   │   ├── alerts.module.ts
│   │   ├── alerts.service.ts
│   │   └── templates/
│   └── audit/
│       ├── audit.module.ts
│       └── audit.service.ts
└── config/
    ├── database.config.ts
    ├── llm.config.ts
    └── hermes.config.ts
```

### 8.2 Responsabilidades por módulo

| Módulo | Responsabilidad | Dependencias |
|--------|----------------|-------------|
| `AuthModule` | Autenticación JWT, roles (admin, analista, viewer) | — |
| `ConvocatoriasModule` | CRUD de convocatorias, búsqueda, filtros | — |
| `CompaniesModule` | CRUD de empresas, perfil, capacidad, experiencia | — |
| `ScoringModule` | **Core:** motor de scoring, filtros duros, explicador | Companies, Convocatorias, Competitors, RAG, LLM |
| `CompetitorsModule` | Análisis de competidores históricos | Convocatorias |
| `RagModule` | Ingesta documental, chunking, embeddings, retrieval | Documents, LLM |
| `DocumentsModule` | Parseo de PDF/DOCX, almacenamiento, metadata | — |
| `LlmModule` | Abstracción de proveedor IA. Embeddings + Chat | — |
| `AlertsModule` | Templates de correo, dispatch vía Hermes | Companies, Convocatorias, Scoring |
| `AuditModule` | Trazabilidad de scores, decisiones, cambios | — |

---

## 9. Pipeline de Ingesta de Convocatorias

### 9.1 Flujo completo

```
Hermes (scheduler)
  │
  │  Cada N horas: "buscá convocatorias abiertas en SECOP"
  ▼
SODA API 3.0 (datos.gov.co)
  │  POST /api/v3/views/rpmr-utcd/query.json
  │  WHERE estado_del_proceso = 'Convocado'
  │  ORDER BY fecha_de_firma_del_contrato DESC
  │  pageSize: 50000, con paginación
  ▼
Hermes: deduplicación básica + POST a NestJS
  │
  ▼
NestJS ConvocatoriasService.ingestBatch()
  │
  ├─► 1. Validación (DTOs con class-validator)
  │
  ├─► 2. Deduplicación por numero_de_proceso
  │      Si existe → actualizar estado
  │      Si no existe → crear
  │
  ├─► 3. Clasificación de sector (SectorClassifier)
  │      Reglas de keywords + LLM para casos ambiguos
  │
  ├─► 4. Enriquecimiento
  │      - Normalizar nombres de entidad
  │      - Geolocalizar municipio
  │      - Calcular métricas rápidas (percentil de valor, etc.)
  │
  ├─► 5. Persistencia en PostgreSQL
  │
  └─► 6. Si es nueva convocatoria → emitir evento
         NewConvocatoriaEvent → dispara:
           - ScoringJob (cola BullMQ)
           - DocumentFetchJob → notifica a Hermes
           - AlertEvaluationJob
```

### 9.2 Estados de una convocatoria en el sistema

```
                    ┌──────────┐
                    │ PENDING  │ ← Recién ingresa
                    └────┬─────┘
                         │ clasificación + enriquecimiento
                    ┌────▼─────┐
                    │ ENRICHED │
                    └────┬─────┘
                         │ scoring ejecutado
                    ┌────▼─────┐
               ┌────│ SCORED   │────┐
               │    └──────────┘    │
               ▼                    ▼
        ┌────────────┐      ┌────────────┐
        │ VIABLE     │      │ LOW_PRIO   │
        │ (score>70) │      │ (score<40) │
        └────────────┘      └────────────┘
               │
               ▼
        ┌────────────┐
        │ APPLIED    │ ← Empresa marcó que aplicó
        └────────────┘
```

---

## 10. Pipeline de Normalización Documental

### 10.1 Qué documentos importan

| Documento | Fuente | Relevancia |
|-----------|--------|------------|
| Pliego de condiciones | URL en SECOP | Crítica — requisitos, criterios de evaluación |
| Adendas | URL en SECOP | Alta — modifican condiciones |
| Estudios previos | URL en SECOP | Media — contexto y justificación |
| Certificado de disponibilidad presupuestal | URL en SECOP | Media — confirma presupuesto |
| Documentos de la empresa | Upload del usuario | Crítica — experiencia, certificaciones, RUP |

### 10.2 Flujo

```
Hermes: descarga documento de URL
  │
  ▼
NestJS POST /documentos
  │
  ├─► Validar tipo MIME (PDF, DOCX, HTML)
  │
  ├─► Parsear (pdf-parse, mammoth para DOCX)
  │
  ├─► Extraer metadatos:
  │     - Tipo de documento (pliego, adenda, estudio previo)
  │     - Fecha de publicación
  │     - Convocatoria asociada (numero_de_proceso)
  │     - Entidad emisora
  │
  ├─► Almacenar:
  │     - Texto plano + metadatos en PostgreSQL (tabla documents)
  │     - Archivo original en file storage (S3-compatible o filesystem)
  │
  └─► Disparar indexación en RAG:
        ChunkerService → EmbedderService → pgvector
```

### 10.3 Estrategia de chunking

```
Documento PDF (50 páginas)
  │
  ├─► Chunk 1: "1. OBJETO DEL CONTRATO\n..."   (metadata: sección=objeto)
  ├─► Chunk 2: "2. REQUISITOS TÉCNICOS\n..."   (metadata: sección=requisitos)
  ├─► Chunk 3: "3. CRITERIOS DE EVALUACIÓN\n..." (metadata: sección=criterios)
  └─► ...
```

- **Tamaño de chunk:** 500-1000 tokens con overlap de 100 tokens.
- **Estrategia:** Chunking semántico por secciones cuando el documento tiene estructura. Sliding window con overlap cuando es texto plano continuo.
- **Metadatos por chunk:** `documento_id`, `convocatoria_id`, `tipo_documento`, `seccion`, `pagina`, `entidad`.

---

## 11. Diseño del RAG

### 11.1 Arquitectura del RAG

```
┌──────────────────────────────────────────────────────────────┐
│                      RAG SYSTEM                               │
│                                                               │
│  INGESTA                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐  │
│  │ Document │──▶│ Parser   │──▶│ Chunker  │──▶│ Embedder │  │
│  │ Upload   │   │ PDF/DOCX │   │ 500-1K   │   │ OpenCode │  │
│  └──────────┘   └──────────┘   └──────────┘   └─────┬────┘  │
│                                                      │       │
│                                                      ▼       │
│                                              ┌──────────┐    │
│                                              │ pgvector │    │
│                                              │ + meta   │    │
│                                              └──────────┘    │
│                                                               │
│  RETRIEVAL                                                    │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐  │
│  │ Query    │──▶│ Embed    │──▶│ Semantic │──▶│ Rerank   │  │
│  │ (user)   │   │ Query    │   │ Search   │   │ + Filter │  │
│  └──────────┘   └──────────┘   └──────────┘   └─────┬────┘  │
│                                                      │       │
│                                                      ▼       │
│                                              ┌──────────┐    │
│                                              │ Context  │    │
│                                              │ Window   │    │
│                                              └──────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 11.2 Combinación: búsqueda semántica + filtros estructurados

```sql
-- Ejemplo: buscar chunks sobre "requisitos financieros" en pliegos de Antioquia
SELECT
    c.texto,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
FROM chunks c
JOIN documents d ON c.documento_id = d.id
JOIN convocatorias co ON d.convocatoria_id = co.id
WHERE
    c.embedding <=> query_embedding < 0.3           -- filtro semántico
    AND d.tipo_documento = 'pliego'                  -- filtro estructurado
    AND co.departamento_entidad = 'Antioquia'        -- filtro estructurado
ORDER BY similarity DESC
LIMIT 10;
```

### 11.3 Lo que el RAG NO debe hacer

| ❌ No | ✅ Alternativa |
|------|---------------|
| "¿Esta convocatoria es viable?" | El scoring determinístico decide. El RAG aporta contexto. |
| "¿Cuánto vale esta licitación?" | Dato estructurado en PostgreSQL. |
| "¿Quiénes son mis competidores?" | Query SQL sobre tabla `competitors`. |
| Decidir sin evidencia | Siempre citar fuente: chunk, documento, página. |

### 11.4 Lo que el RAG SÍ debe hacer

- Responder: "¿Qué requisitos de experiencia pide esta convocatoria?"
- Responder: "¿Qué certificaciones exige el pliego?"
- Responder: "¿Hay cláusulas de incumplimiento inusuales en este pliego?"
- Proveer extractos textuales para justificar una variable del score.
- Generar resumen ejecutivo de un pliego de 200 páginas.

---

## 12. Diseño del Scoring de Viabilidad

### 12.1 Principio

> El scoring es una **función determinística con entradas estructuradas**. La IA puede asistir en extraer algunas entradas desde texto no estructurado, pero el cálculo del score es determinístico, repetible y auditable.

### 12.2 Pipeline de evaluación

```
Convocatoria + Empresa
        │
        ▼
┌─────────────────────┐
│ 1. FILTROS DUROS    │  ← Determinístico, binario
│ (Hard Filters)      │
└────────┬────────────┘
         │ ¿Pasa?
         ├── NO → Estado: EXCLUIDO (razón explícita)
         │
         ▼ SI
┌─────────────────────┐
│ 2. SCORING NUMÉRICO │  ← 0-100, 5 variables ponderadas
│ (Numeric Score)     │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ 3. CATEGORIZACIÓN   │  ← Umbrales
│ (Classification)    │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ 4. EXPLICACIÓN      │  ← NLG con datos + RAG
│ (Explanation)       │
└─────────────────────┘
```

### 12.3 Filtros duros (Hard Filters)

Antes del score, se verifica lo siguiente. Si alguna condición falla → `EXCLUIDO`.

| Filtro | Condición | Razón de exclusión |
|--------|-----------|-------------------|
| **Capacidad financiera** | `valor_contrato > empresa.capacidad_financiera_max` | "El valor del contrato (${X}) excede tu capacidad financiera declarada (${Y})" |
| **Sector no atendido** | `convocatoria.sector NOT IN empresa.sectores` | "Esta convocatoria es del sector {X}. No tenés ese sector en tu perfil." |
| **Región no atendida** | `convocatoria.departamento NOT IN empresa.regiones` | "No operás en {departamento}." |
| **Tipo de contrato excluido** | `convocatoria.tipo_contrato IN empresa.tipos_excluidos` | "Marcaste '{tipo}' como tipo de contrato excluido." |
| **Fecha límite vencida** | `convocatoria.fecha_fin < now()` | "La convocatoria ya cerró." |
| **Modalidad no manejada** | `convocatoria.modalidad IN empresa.modalidades_excluidas` | "No trabajás con '{modalidad}'." |

### 12.4 Variables del score (0-100)

```typescript
interface ScoreBreakdown {
  technicalFit: number;        // 0-40 puntos — ¿podés hacer el trabajo?
  economicFit: number;         // 0-25 puntos — ¿es buen negocio?
  experienceMatch: number;     // 0-20 puntos — ¿ya hiciste algo similar?
  processRisk: number;         // 0-10 puntos — ¿qué tan riesgoso es el proceso?
  competitivePressure: number; // 0-5 puntos  — ¿cuánta competencia hay?

  total: number;               // 0-100 (suma de arriba)
}
```

### 12.5 Desglose por variable

#### A. Technical Fit (0-40 puntos)

¿Qué tan bien se alinea la convocatoria con las capacidades técnicas de la empresa?

| Sub-variable | Peso en 40 | Fuente | Cálculo |
|-------------|-----------|--------|---------|
| Coincidencia de sector | 15 | `SectorClassifier` vs `company.sectores` | 15 si es sector primario, 7 si es secundario |
| Keywords del objeto matchean experiencia | 10 | RAG sobre docs de empresa + `LIKE` sobre histórico | % de keywords del objeto encontradas en docs de experiencia |
| Certificaciones requeridas | 10 | RAG: extraer certificaciones del pliego | % de certificaciones requeridas que la empresa posee |
| Personal requerido disponible | 5 | RAG: extraer perfiles del pliego | % de perfiles que la empresa tiene en planta |

```typescript
// technical-fit.calc.ts
function calculateTechnicalFit(
  convocatoria: Convocatoria,
  empresa: Empresa,
  ragEvidence: RagResult[]
): { score: number; evidence: string[] } {
  // Determinístico, no LLM
  let score = 0;
  const evidence: string[] = [];

  // Sector match
  const sectorScore = matchSector(convocatoria.sector, empresa.sectores);
  score += sectorScore;
  evidence.push(`Sector ${convocatoria.sector}: ${sectorScore}/15`);

  // ... resto de sub-variables

  return { score: Math.min(score, 40), evidence };
}
```

#### B. Economic Fit (0-25 puntos)

| Sub-variable | Peso en 25 | Cálculo |
|-------------|-----------|---------|
| Margen estimado | 10 | `(empresa.margen_esperado - margen_estimado_convocatoria) / empresa.margen_esperado * 10` |
| Relación valor/plazo | 8 | `valor / duracion_meses` vs capacidad operativa mensual |
| Capacidad financiera | 7 | `valor_contrato / empresa.capacidad_financiera_max`. Más cerca de 1 = menos puntos |

#### C. Experience Match (0-20 puntos)

| Sub-variable | Peso en 20 | Fuente |
|-------------|-----------|--------|
| Contratos similares en histórico | 12 | Query: `count(*) WHERE empresa.nit = documento_proveedor AND objeto LIKE keywords` |
| Experiencia con la entidad | 5 | Query: `count(*) WHERE empresa.nit = documento_proveedor AND codigo_entidad = X` |
| Experiencia en el departamento | 3 | Query: `count(*) WHERE empresa.nit = documento_proveedor AND departamento = X` |

#### D. Process Risk (0-10 puntos)

| Sub-variable | Peso en 10 | Cálculo |
|-------------|-----------|---------|
| Modalidad de contratación | 4 | Licitación Pública = 4 (más riesgo), Contratación Directa = 1 (menos competencia abierta) |
| Historial de la entidad (cancelaciones) | 3 | % de procesos cancelados por esta entidad |
| Plazo de ejecución | 3 | Muy corto (< 1 mes) = más riesgo, razonable = menos |

#### E. Competitive Pressure (0-5 puntos)

| Sub-variable | Peso en 5 | Cálculo |
|-------------|-----------|---------|
| Cantidad de competidores activos en el sector | 3 | `count(DISTINCT documento_proveedor) WHERE sector = X AND departamento = Y` |
| Concentración histórica con esta entidad | 2 | Índice HHI (Herfindahl-Hirschman) de adjudicaciones de esta entidad |

### 12.6 Categorización final

```typescript
function categorizeScore(total: number): 'VIABLE' | 'REVISAR' | 'BAJA_PRIORIDAD' {
  if (total >= 70) return 'VIABLE';
  if (total >= 40) return 'REVISAR';
  return 'BAJA_PRIORIDAD';
}
```

| Categoría | Score | Significado | Acción |
|-----------|-------|-------------|--------|
| **VIABLE** | 70-100 | Alta probabilidad de éxito | Preparar oferta |
| **REVISAR** | 40-69 | Posible pero con riesgos | Revisar en detalle, evaluar mitigaciones |
| **BAJA PRIORIDAD** | 0-39 | Poco probable | Monitorear pasivamente |
| **EXCLUIDO** | — | No pasa filtros duros | Ignorar con razón documentada |

### 12.7 Explicación del score

Para cada score, se genera una explicación en lenguaje natural. Esto **sí** usa LLM, pero con datos estructurados como entrada:

```typescript
// score-explainer.service.ts
async function explainScore(breakdown: ScoreBreakdown): Promise<string> {
  const prompt = `
Eres un analista de licitaciones. Explicá en 3-4 párrafos por qué esta convocatoria
obtuvo un score de ${breakdown.total}/100.

Datos del scoring:
- Ajuste técnico: ${breakdown.technicalFit}/40
- Ajuste económico: ${breakdown.economicFit}/25
- Experiencia similar: ${breakdown.experienceMatch}/20
- Riesgo del proceso: ${breakdown.processRisk}/10
- Presión competitiva: ${breakdown.competitivePressure}/5

Categoría: ${categorizeScore(breakdown.total)}
Evidencia del RAG: [adjuntar extractos relevantes]
`;

  return this.llm.chat({ messages: [{ role: 'user', content: prompt }] });
}
```

---

## 13. Diseño del Análisis de Competencia

### 13.1 Datos disponibles en SECOP para análisis competitivo

El dataset SECOP Integrado contiene para cada contrato adjudicado:

- `nom_raz_social_contratista` — quién ganó
- `documento_proveedor` — identificación fiscal
- `tipo_documento_proveedor` — persona natural o jurídica
- `valor_contrato` — monto adjudicado
- `nombre_de_la_entidad` — quién contrató
- `departamento_entidad`, `municipio_entidad` — ubicación
- `objeto_a_contratar` — qué compraron
- `tipo_de_contrato`, `modalidad_de_contrataci_n` — cómo contrataron
- `fecha_de_firma_del_contrato` — cuándo

### 13.2 Métricas de competencia por contratista

```sql
-- Perfil completo de un competidor
SELECT
    nom_raz_social_contratista,
    count(*) AS total_contratos,
    sum(valor_contrato) AS monto_total,
    avg(valor_contrato) AS ticket_promedio,
    max(valor_contrato) AS contrato_max,
    count(DISTINCT codigo_entidad_en_secop) AS entidades_unicas,
    count(DISTINCT departamento_entidad) AS departamentos_unicos,
    -- Tasa de éxito (solo aplica si hay datos de Convocado vs Adjudicado)
    -- Esto requiere tracking adicional
FROM convocatorias
WHERE documento_proveedor = 'NIT_COMPETIDOR'
GROUP BY nom_raz_social_contratista;
```

### 13.3 Modelo de datos de competencia

```typescript
interface CompetitorProfile {
  id: string;
  nombre: string;
  documento: string;
  tipoDocumento: string;

  // Métricas agregadas (precalculadas y actualizadas periódicamente)
  totalContratos: number;
  montoTotalAdjudicado: number;
  ticketPromedio: number;
  entidadesFrecuentes: Array<{ entidad: string; count: number; monto: number }>;
  departamentosFrecuentes: Array<{ departamento: string; count: number }>;
  sectoresFuertes: Array<{ sector: string; count: number; monto: number }>;
  modalidadesFrecuentes: Array<{ modalidad: string; count: number }>;

  // Temporal
  primeraAdjudicacion: Date;
  ultimaAdjudicacion: Date;
  adjudicacionesPorAnio: Record<number, { count: number; monto: number }>;

  lastUpdated: Date;
}
```

### 13.4 Cálculo de presión competitiva para una convocatoria

```typescript
// competitor-analyzer.service.ts
async function calculateCompetitivePressure(
  convocatoria: Convocatoria
): Promise<CompetitivePressureResult> {
  // 1. Buscar competidores activos en el mismo sector + departamento
  const competitors = await this.findCompetitors(
    convocatoria.sector,
    convocatoria.departamento_entidad
  );

  // 2. Para cada competidor, ver si ya trabajó con esta entidad
  const withEntity = competitors.filter(c =>
    c.entidadesFrecuentes.some(e => e.entidad === convocatoria.nombre_de_la_entidad)
  );

  // 3. Calcular índice de concentración HHI
  const hhi = calculateHHI(competitors); // Herfindahl-Hirschman Index

  return {
    totalCompetitors: competitors.length,
    competitorsWithEntityHistory: withEntity.length,
    topCompetitors: competitors.slice(0, 5),
    concentrationIndex: hhi,
    pressureLevel: hhi > 2500 ? 'ALTA' : hhi > 1500 ? 'MEDIA' : 'BAJA'
  };
}
```

### 13.5 Análisis de consorcios (futuro)

Los consorcios son comunes en contratación pública colombiana. Detectar patrones:

```sql
-- Si el dataset incluye estructura de consorcio (UT, consorcio), buscar co-ocurrencias
SELECT
    a.documento_proveedor AS socio_a,
    b.documento_proveedor AS socio_b,
    count(*) AS veces_juntos
FROM adjudicaciones a
JOIN adjudicaciones b
  ON a.numero_proceso = b.numero_proceso
 AND a.documento_proveedor < b.documento_proveedor
GROUP BY socio_a, socio_b
HAVING count(*) > 3
ORDER BY veces_juntos DESC;
```

Este análisis requiere un parser de nombres de consorcios — un `nom_raz_social_contratista` como `"UNIÓN TEMPORAL ABC 2023"` debe descomponerse en sus miembros. Esto es viable con LLM + base de datos de miembros conocidos.

---

## 14. Diseño de Alertas y Notificaciones

### 14.1 Tipos de alerta

| Tipo | Trigger | Canal | Prioridad |
|------|---------|-------|-----------|
| **Nueva convocatoria viable** | Score ≥ 70 en nuevo ingreso | Email | ALTA |
| **Nueva convocatoria revisar** | Score 40-69 en nuevo ingreso | Email (resumen diario) | MEDIA |
| **Cambio de estado** | Convocatoria seguida cambió de estado | Email | ALTA |
| **Cierre inminente** | Faltan ≤ 3 días para cierre | Email + notificación web | ALTA |
| **Resumen semanal** | Todas las novedades de la semana | Email | BAJA |

### 14.2 Flujo de alerta

```
NestJS AlertsModule
  │
  │  Evalúa condiciones de alerta
  │
  ├─► ¿Es alerta inmediata (ALTA)?
  │     Sí → POST /hermes/send-email (inmediato)
  │
  └─► ¿Es alerta de resumen (MEDIA/BAJA)?
        Sí → acumular en tabla pending_alerts
             Hermes (cada N horas): POST /alerts/digest → envía resumen
```

### 14.3 Template de correo (ejemplo)

```
Asunto: 🔴 [VIABLE] Nueva licitación en Salud — Antioquia — $450M COP

ENTIDAD: Hospital General de Medellín
OBJETO: Suministro de medicamentos e insumos hospitalarios
VALOR: $450,000,000 COP
MODALIDAD: Licitación Pública
CIERRE: 25 de mayo de 2026
SCORE: 82/100 (VIABLE ✅)

¿Por qué es viable?
• Ajuste técnico: 35/40 — tu experiencia en suministros hospitalarios es sólida
• Ajuste económico: 20/25 — margen estimado del 18%
• Experiencia similar: 15/20 — 12 contratos similares en los últimos 3 años
• Riesgo del proceso: 8/10 — proceso estándar, entidad confiable
• Presión competitiva: 4/5 — solo 2 competidores activos en la región

[Ver análisis completo →]
[Ver pliego de condiciones →]
```

### 14.4 Integración NestJS ↔ Hermes para correos

```typescript
// alerts.service.ts
@Injectable()
export class AlertsService {
  async sendImmediateAlert(
    company: Company,
    convocatoria: Convocatoria,
    score: ScoreBreakdown
  ): Promise<void> {
    const emailPayload = this.buildEmailPayload(company, convocatoria, score);

    await this.httpService.post(
      `${this.hermesBaseUrl}/send-email`,
      emailPayload
    ).toPromise();
  }

  async sendDigest(companyId: string): Promise<void> {
    const pendingAlerts = await this.getPendingAlerts(companyId);
    if (pendingAlerts.length === 0) return;

    await this.httpService.post(
      `${this.hermesBaseUrl}/send-email`,
      { template: 'digest', alerts: pendingAlerts }
    ).toPromise();

    await this.markAlertsSent(pendingAlerts);
  }
}
```

---

## 15. Diseño de Integración Frontend-Backend

### 15.1 API REST (comunicación principal)

```
GET    /api/convocatorias              — Listar con filtros, paginación
GET    /api/convocatorias/:id          — Detalle
POST   /api/convocatorias/bulk         — Ingesta batch (desde Hermes)
GET    /api/companies                  — Listar empresas
POST   /api/companies                  — Crear empresa
PUT    /api/companies/:id              — Actualizar perfil
GET    /api/scoring/:companyId/:convId — Obtener score
POST   /api/scoring/:companyId/batch   — Calcular scores para empresa vs N convocatorias
GET    /api/competitors/:convId        — Análisis de competencia para convocatoria
POST   /api/rag/query                  — Consultar RAG
POST   /api/documents                  — Subir documento
GET    /api/alerts/config              — Configuración de alertas
```

### 15.2 SSE (Server-Sent Events) — para feedback en tiempo real

```
GET /api/scoring/:companyId/batch/stream
  → event: progress
    data: {"current": 45, "total": 200, "convocatoria": "OP-10-2435-2019"}

  → event: result
    data: {"convocatoriaId": "...", "score": 82, "category": "VIABLE"}

  → event: complete
    data: {"total": 200, "viable": 12, "revisar": 34, "bajaPrioridad": 154}
```

```typescript
// scoring.controller.ts
@Sse('scoring/:companyId/batch/stream')
async streamBatchScores(
  @Param('companyId') companyId: string
): Observable<MessageEvent> {
  return new Observable(subscriber => {
    this.scoringService.batchScoreWithProgress(
      companyId,
      (progress) => subscriber.next({ data: progress }),
      (result) => subscriber.next({ data: result }),
      () => subscriber.complete()
    );
  });
}
```

---

## 16. Diseño de Trazabilidad, Auditoría y Observabilidad

### 16.1 Trazabilidad del scoring

Cada score se almacena con todas sus variables. Esto permite **reproducir** cualquier score en cualquier momento.

```sql
CREATE TABLE score_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  convocatoria_id UUID NOT NULL REFERENCES convocatorias(id),
  total_score DECIMAL(5,2) NOT NULL,
  category VARCHAR(20) NOT NULL, -- VIABLE, REVISAR, BAJA_PRIORIDAD, EXCLUIDO
  breakdown JSONB NOT NULL, -- las 5 variables con sub-detalle
  explanation TEXT,         -- texto generado por LLM
  rag_evidence JSONB,       -- chunks usados como evidencia
  filter_result JSONB,      -- resultado de filtros duros
  model_version VARCHAR(50),-- versión del scoring engine
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_score_logs_company ON score_logs(company_id, created_at DESC);
CREATE INDEX idx_score_logs_convocatoria ON score_logs(convocatoria_id);
```

El JSONB `breakdown` se ve así:

```json
{
  "technicalFit": {
    "score": 35,
    "max": 40,
    "subScores": {
      "sectorMatch": { "score": 15, "max": 15, "detail": "Sector primario: SALUD" },
      "keywordMatch": { "score": 8, "max": 10, "matchedKeywords": ["medicamento", "hospitalario"] },
      "certificaciones": { "score": 7, "max": 10, "missing": ["ISO 13485"] },
      "personal": { "score": 5, "max": 5, "detail": "100% perfiles cubiertos" }
    }
  },
  "economicFit": { /* ... */ },
  "experienceMatch": { /* ... */ },
  "processRisk": { /* ... */ },
  "competitivePressure": { /* ... */ }
}
```

### 16.2 Auditoría de cambios

```sql
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL, -- 'company', 'convocatoria', 'score_config'
  entity_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL,      -- 'CREATE', 'UPDATE', 'DELETE', 'SCORE'
  actor VARCHAR(100),               -- usuario o 'system'
  changes JSONB,                    -- diff de lo que cambió
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Implementado como interceptor NestJS:

```typescript
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    // Registrar acción, usuario, endpoint
    return next.handle().pipe(
      tap(response => {
        // Comparar request.body con entidad previa → guardar diff
      })
    );
  }
}
```

### 16.3 Observabilidad

- **Logging estructurado:** Pino o Winston con correlation IDs en cada request.
- **Health checks:** `/health` endpoint que verifica PostgreSQL, pgvector, Hermes, y OpenCode Go.
- **Métricas de scoring:** Prometheus/Grafana opcional. Mínimo: logs de duración de cada batch scoring.
- **Alertas de sistema:** Si Hermes no responde, si pgvector está caído, si la API SODA cambió.

---

## 17. Modelo de Datos Sugerido

### 17.1 Entidades principales

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│  companies   │       │  convocatorias    │       │  documents   │
├──────────────┤       ├──────────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)           │       │ id (PK)      │
│ nombre       │       │ numero_proceso    │       │ conv_id (FK) │
│ nit          │       │ objeto_a_contratar│       │ tipo         │
│ capacidad_fin│       │ valor_contrato     │       │ nombre       │
│ sectores[]   │       │ estado             │       │ url_origen   │
│ regiones[]   │       │ modalidad          │       │ texto_plano  │
│ experiencia  │       │ tipo_contrato      │       │ metadata     │
│ created_at   │       │ departamento       │       │ created_at   │
│ updated_at   │       │ municipio          │       └──────────────┘
└──────────────┘       │ entidad_nombre     │              │
       │               │ fecha_firma        │              │
       │               │ fecha_inicio       │              ▼
       │               │ fecha_fin          │       ┌──────────────┐
       │               │ sector (clasif.)   │       │   chunks     │
       │               │ origen             │       ├──────────────┤
       │               │ raw_data (JSONB)   │       │ id (PK)      │
       │               │ created_at         │       │ doc_id (FK)  │
       │               │ updated_at         │       │ conv_id (FK) │
       │               └──────────────────┘       │ texto        │
       │                       │                  │ embedding    │
       │                       │                  │ metadata     │
       │                       │                  │ pagina       │
       ▼                       ▼                  │ seccion      │
┌──────────────┐       ┌──────────────────┐       └──────────────┘
│ score_logs   │       │ competitor_prof  │
├──────────────┤       ├──────────────────┤
│ id (PK)      │       │ id (PK)          │
│ company_id   │       │ nombre           │
│ conv_id      │       │ documento        │
│ total_score  │       │ metricas (JSONB) │
│ category     │       │ last_updated     │
│ breakdown    │       └──────────────────┘
│ explanation  │
│ rag_evidence │
│ created_at   │
└──────────────┘
```

### 17.2 Tablas de soporte

| Tabla | Propósito |
|-------|-----------|
| `sector_keywords` | Mapa de sector → lista de keywords + pesos |
| `alert_configs` | Configuración de alertas por empresa |
| `alert_pending` | Alertas acumuladas para resumen diario |
| `audit_events` | Trazabilidad genérica |
| `ingestion_jobs` | Tracking de jobs de ingesta (Hermes → NestJS) |
| `company_documents` | Documentos propios de la empresa (experiencia, RUP, etc.) |
| `exclusion_rules` | Reglas de exclusión por empresa (tipos de contrato, modalidades) |

---

## 18. Estrategia de Persistencia

### 18.1 PostgreSQL — Datos estructurados

Todo lo relacional. Esquema bien normalizado con JSONB para datos semiestructurados (raw_data de SECOP, breakdown de scores, métricas de competidores).

**Índices críticos:**

```sql
-- Búsqueda de convocatorias
CREATE INDEX idx_conv_estado ON convocatorias(estado);
CREATE INDEX idx_conv_sector ON convocatorias(sector);
CREATE INDEX idx_conv_departamento ON convocatorias(departamento_entidad);
CREATE INDEX idx_conv_fecha ON convocatorias(fecha_de_firma_del_contrato DESC);
CREATE INDEX idx_conv_valor ON convocatorias(valor_contrato);

-- Búsqueda full-text sobre objetos
CREATE INDEX idx_conv_objeto_gin ON convocatorias
  USING gin(to_tsvector('spanish', objeto_a_contratar));

-- Competidores
CREATE INDEX idx_conv_contratista ON convocatorias(documento_proveedor);
CREATE INDEX idx_conv_entidad ON convocatorias(codigo_entidad_en_secop);

-- Scores
CREATE INDEX idx_score_company_conv ON score_logs(company_id, convocatoria_id);
```

### 18.2 pgvector — Embeddings para RAG

pgvector se elige sobre alternativas externas (Pinecone, Weaviate, Qdrant) por:

- **Cero dependencia operativa nueva.** Ya tenemos PostgreSQL.
- **Transaccionalidad.** Los chunks y sus metadatos viven en la misma base que los datos estructurados. Una query puede hacer JOIN entre similitud semántica y filtros SQL.
- **Suficiente para el volumen.** 100K chunks ≈ unos cientos de MB. pgvector escala bien hasta millones.
- **Sin vendor lock-in.** Si en el futuro se necesita Qdrant/Milvus, migrar es cambiar una implementación de `VectorStore`, no la arquitectura.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  convocatoria_id UUID REFERENCES convocatorias(id),
  texto TEXT NOT NULL,
  embedding VECTOR(1536), -- dimensión depende del modelo
  metadata JSONB NOT NULL DEFAULT '{}',
  pagina INTEGER,
  seccion VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice IVFFlat para búsqueda aproximada
CREATE INDEX idx_chunks_embedding ON chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 18.3 File Storage

Archivos originales (PDFs, DOCX):
- **Desarrollo:** filesystem local (`./storage/documents/`)
- **Producción:** S3-compatible (MinIO, AWS S3, Cloudflare R2)
- Abstracción mediante interfaz `FileStorageService` para cambiar sin impacto.

### 18.4 Colas y eventos (BullMQ + Redis)

Para pipelines asíncronos:

```
Evento: NewConvocatoriaIngested
  → ScoringJob (cola: scoring, prioridad: alta)
  → DocumentFetchJob (cola: documents, prioridad: media)

Evento: DocumentParsed
  → ChunkingJob (cola: rag-ingest)
    → EmbeddingJob (cola: rag-ingest)

Evento: ScoreCalculated
  → AlertEvaluationJob (cola: alerts)
```

---

## 19. Estrategia de Extracción desde SECOP

### 19.1 Fuentes de datos

| Fuente | Tipo | Acceso | Frecuencia |
|--------|------|--------|-----------|
| **SODA API 3.0** (datos.gov.co) | Datos estructurados | API REST (POST) | Cada 6 horas |
| **Portal SECOP I** (contratos.gov.co) | URLs de procesos | HTTP GET (HTML) | On-demand (cuando hay URL nueva) |
| **SECOP II** (community.secop.gov.co) | Plataforma transaccional | API o scraping | On-demand |
| **Documentos adjuntos** | PDF, DOCX | HTTP download | On-demand |

### 19.2 Estrategia por fuente

#### SODA API 3.0 (fuente primaria)

```
Hermes: cada 6 horas
  → POST /api/v3/views/rpmr-utcd/query.json
     query: "SELECT * WHERE estado_del_proceso IN('Convocado','En ejecución','Adjudicado')"
     page: {pageNumber: 1, pageSize: 50000}
  → Paginar hasta agotar
  → POST /api/convocatorias/bulk a NestJS
```

#### Documentos de convocatorias (fuente secundaria)

```
NestJS: detecta nueva convocatoria con url_contrato
  → POST /hermes/download-document
     { url: "https://www.contratos.gov.co/...", tipo: "pliego" }
  → Hermes: navega o hace fetch del documento
  → Hermes: POST /api/documents a NestJS con el binario
```

#### Fallback: scraping controlado

Si alguna fuente no expone API o cambia su estructura:

```
Hermes (solo si API falla):
  → Abrir navegador (Playwright)
  → Navegar a URL del proceso
  → Extraer datos estructurados
  → POST a NestJS
```

**Regla:** scraping solo como fallback, nunca como estrategia primaria. La API SODA es la fuente canónica.

---

## 20. Hermes vs NestJS: División de Responsabilidades

### 20.1 Tabla de responsabilidades

| Responsabilidad | NestJS | Hermes | Justificación |
|----------------|--------|--------|---------------|
| **Lógica de scoring** | ✅ | ❌ | Determinística, auditable, core del negocio |
| **Clasificación de sectores** | ✅ | ❌ | Reglas + LLM coordinado desde NestJS |
| **Análisis de competencia** | ✅ | ❌ | Queries SQL agregadas, core del negocio |
| **API REST para frontend** | ✅ | ❌ | Nativo de NestJS |
| **Autenticación/autorización** | ✅ | ❌ | NestJS Guards + JWT |
| **Consulta al RAG** | ✅ | ❌ | pgvector + LLM, orquestado desde NestJS |
| **Búsqueda periódica en SECOP** | ❌ | ✅ | Cron + HTTP client, tarea de automatización |
| **Descarga de documentos** | ❌ | ✅ | HTTP downloads masivos, manejo de timeouts |
| **Scraping (fallback)** | ❌ | ✅ | Navegación web con Playwright |
| **Envío de correos** | ❌ | ✅ | SMTP, templates, rate limiting |
| **Indexación masiva en RAG** | ❌ | ✅ | Batch processing de docs → chunks → embeddings |
| **Modelo de IA (chat/embeddings)** | ❌ | ❌ | ✅ OpenCode Go — proveedor externo |
| **Validación de datos** | ✅ | ❌ | DTOs + class-validator en NestJS |
| **Persistencia** | ✅ | ❌ | TypeORM/Prisma en NestJS |

### 20.2 Contratos de API entre NestJS y Hermes

```
# NestJS → Hermes
POST /hermes/search-convocatorias    { filters: {...}, schedule?: cron }
POST /hermes/download-document       { url: string, tipo: string }
POST /hermes/index-documents         { documentIds: string[] }
POST /hermes/send-email              { template, to, data }

# Hermes → NestJS
POST /api/convocatorias/bulk         { convocatorias: ConvocatoriaDto[] }
POST /api/documents                  { file, metadata }
GET  /api/health                     → 200 OK
```

### 20.3 Lo que Hermes NUNCA debe hacer

- ❌ Calcular scores
- ❌ Decidir si una convocatoria es viable
- ❌ Clasificar sectores (puede llamar al endpoint de NestJS que lo hace)
- ❌ Consultar la base de datos directamente
- ❌ Modificar configuraciones de scoring
- ❌ Tener lógica condicional de negocio ("si score > 70 entonces...")

---

## 21. Riesgos Técnicos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| **API SODA 3.0 cambia** | Media | Alto | Abstracción `SecopDataSource`. Cambiar implementación sin tocar negocio. |
| **App token revocado o expirado** | Baja | Alto | Health check cada 30 min. Alerta si falla 3 veces seguidas. |
| **Hermes no disponible** | Media | Medio | NestJS sigue funcionando para consultas. Sin ingesta nueva. Timeout + circuit breaker. |
| **OpenCode Go no disponible** | Baja | Medio | Degradación elegante: scores sin explicación NLG, RAG sin embeddings nuevos. No bloquea el sistema. |
| **Volumen de documentos explota** | Media | Bajo | Límites configurables por empresa (ej: 50 docs). Limpieza periódica de chunks huérfanos. |
| **Score mal calibrado (falsos positivos)** | Alta al inicio | Medio | Feedback loop: usuario marca "no viable". Reentrenamiento de umbrales. |
| **Datos inconsistentes en SECOP** | Alta | Medio | Validación estricta en ingesta. Raw data siempre preservado en JSONB. |
| **Licencias de documentos** | Baja | Bajo | Solo indexar docs públicos. No redistribuir PDFs originales. |
| **Latencias en batch scoring** | Media | Medio | Paginación de scores vía BullMQ. SSE para feedback en tiempo real. |

---

## 22. Fases de Implementación

### Fase 1: Fundación (4-6 semanas)

**Objetivo:** Backend funcional con ingesta, scoring básico, y dashboard mínimo.

- [ ] NestJS scaffold con módulos core
- [ ] PostgreSQL + pgvector + migraciones
- [ ] `ConvocatoriasModule`: CRUD, ingesta batch, clasificación por keywords
- [ ] `CompaniesModule`: CRUD, perfil con sectores y regiones
- [ ] `ScoringModule`: filtros duros + 3 variables (technical, economic, experience)
- [ ] `LlmModule`: abstracción `LlmProvider` + implementación OpenCode Go
- [ ] Hermes: scheduler de ingesta desde SODA 3.0 cada 6 horas
- [ ] Dashboard web mínimo: tabla de convocatorias con filtros y scores

### Fase 2: Inteligencia (4-6 semanas)

**Objetivo:** RAG, competencia, y scoring completo.

- [ ] `DocumentsModule`: parseo PDF/DOCX, file storage
- [ ] `RagModule`: chunking, embeddings, retrieval con pgvector
- [ ] `ScoringModule`: scoring completo con 5 variables + explicación NLG
- [ ] `CompetitorsModule`: perfiles, métricas, presión competitiva
- [ ] Hermes: descarga de documentos, ingesta masiva al RAG
- [ ] Dashboard: vista de detalle con score desglosado, evidencia RAG, competidores

### Fase 3: Operación (3-4 semanas)

**Objetivo:** Alertas, auditoría, y pulido.

- [ ] `AlertsModule`: correos inmediatos y resúmenes
- [ ] `AuditModule`: trazabilidad completa de scores y decisiones
- [ ] Feedback loop: usuario califica recomendaciones
- [ ] Hermes: envío de alertas programadas
- [ ] Dashboard: configuraciones de alerta, historial de feedback

### Fase 4: Evolución (continuo)

- [ ] Soporte multi-empresa
- [ ] Aprendizaje de preferencias del usuario (ML ligero)
- [ ] Integración con CRM (opcional)
- [ ] Análisis predictivo: ¿qué convocatorias van a salir?
- [ ] Detección de patrones de corrupción o direccionamiento

---

## 23. MVP Sugerido

### Alcance mínimo viable

**Lo que SÍ entra en el MVP (Fase 1 completa):**

1. Ingesta automática de convocatorias abiertas desde SECOP vía Hermes + SODA 3.0
2. Clasificación de sector por reglas de keywords (sin LLM)
3. Perfil de empresa con sectores, regiones, capacidad financiera, tipos excluidos
4. Scoring simplificado (3 variables: technical, economic, experience)
5. Filtros duros completos
6. Dashboard web: tabla de convocatorias con score, filtros, ordenamiento
7. Vista de detalle con desglose básico del score
8. App token configurado

**Lo que NO entra en el MVP:**

- RAG sobre pliegos (Fase 2)
- Análisis de competencia (Fase 2)
- Explicaciones NLG con IA (Fase 2)
- Alertas por correo (Fase 3)
- SSE / streaming de scores
- Multi-empresa

### Demo del MVP

```
Usuario abre dashboard
  → Ve 47 convocatorias abiertas
  → Filtra por sector "SALUD" y departamento "Antioquia"
  → Quedan 12
  → 3 marcadas VIABLE (≥70), 5 REVISAR (40-69), 4 BAJA PRIORIDAD (<40)
  → Click en una VIABLE
  → Ve: score 78/100
    - Técnico: 32/40 👍
    - Económico: 22/25 👍
    - Experiencia: 18/20 👍
    - [EXCLUIDO] Competencia y riesgo (no en MVP)
  → Decide preparar oferta
```

---

## 24. Evoluciones Futuras

### 24.1 Corto plazo (post-MVP)

- **Feedback loop activo:** El usuario marca "aplicamos" / "no aplicamos". El sistema ajusta umbrales de scoring con regresión simple.
- **Notificaciones web:** Toast notifications en el dashboard para nuevas convocatorias viables.
- **Exportación:** PDF del análisis de una convocatoria (para compartir con dirección).

### 24.2 Mediano plazo

- **Detección de direccionamiento:** Patrones sospechosos — pliegos con requisitos extremadamente específicos que solo cumple un proveedor.
- **Predicción de adjudicación:** Basado en histórico de la entidad, ¿qué probabilidad hay de ganar?
- **Integración con SECOP II transaccional:** Si la API lo permite, seguimiento post-aplicación.
- **Análisis de consorcios:** Detección de alianzas frecuentes entre competidores.

### 24.3 Largo plazo

- **Modelo de ML para scoring:** Reemplazar pesos manuales con un modelo entrenado sobre feedback histórico de múltiples empresas. Esto requeriría volumen de datos que no existe en el MVP.
- **Marketplace de inteligencia:** Empresas comparten datos anonimizados de competencia.
- **Agente autónomo de aplicación:** Preparar borradores de propuestas basados en pliegos + documentos de la empresa. Requiere RAG muy maduro y supervisión humana.

---

## Apéndice A: Comparativa de stacks alternativos

| Componente | Elegido | Alternativa | Por qué no |
|-----------|---------|-------------|------------|
| Backend | NestJS | Django/FastAPI | Equipo con experiencia en TS, tipado fuerte para dominio financiero |
| Vector store | pgvector | Pinecone, Weaviate | Simplicidad operativa, SQL + vectores en un solo motor |
| Colas | BullMQ + Redis | RabbitMQ, SQS | Suficiente para la escala. Ya se necesita Redis para caching. |
| File storage | MinIO (S3-compatible) | Local FS | Portabilidad a cloud sin cambios de código |
| LLM Provider | OpenCode Go | OpenAI directo | Evitar vendor lock-in |
| Automatización | Hermes | GitHub Actions, cron | Hermes integra scraping, navegación, y email nativamente |

---

## Apéndice B: Configuración de pesos del scoring (valores iniciales)

Estos pesos son el punto de partida. Deben ajustarse con feedback real.

```typescript
export const DEFAULT_WEIGHTS: ScoreWeights = {
  technicalFit: {
    weight: 0.40,    // 40% del score total
    subWeights: {
      sectorMatch: 15,
      keywordMatch: 10,
      certificaciones: 10,
      personal: 5,
    }
  },
  economicFit: {
    weight: 0.25,    // 25%
    subWeights: {
      margenEstimado: 10,
      relacionValorPlazo: 8,
      capacidadFinanciera: 7,
    }
  },
  experienceMatch: {
    weight: 0.20,    // 20%
    subWeights: {
      contratosSimilares: 12,
      experienciaConEntidad: 5,
      experienciaEnRegion: 3,
    }
  },
  processRisk: {
    weight: 0.10,    // 10%
    subWeights: {
      modalidadRiesgo: 4,
      historialCancelaciones: 3,
      plazoEjecucion: 3,
    }
  },
  competitivePressure: {
    weight: 0.05,    // 5%
    subWeights: {
      competidoresActivos: 3,
      concentracionEntidad: 2,
    }
  }
};
```

---

> **Documento preparado por:** Arquitecto de Solución
> **Fecha:** Mayo 2026
> **Versión:** 1.0 — Propuesta Técnica Inicial

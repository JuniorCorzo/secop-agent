# Proposal: ANC-61 Scaffold NestJS con estructura modular base

## Intent

ANC-61 establece la base backend mínima para el MVP. Hoy `apps/nest` tiene bootstrap NestJS básico, pero no existe estructura modular real para auth, convocatorias, companies, scoring, LLM, jobs, auditoría o configuración. Sin este mapa, las siguientes issues van a mezclar responsabilidades o duplicar convenciones.

Debe ir primero porque define **dónde vive cada cosa** antes de agregar DB, auth, colas, entidades o endpoints. Es cimiento, no fachada.

## Scope

### In Scope
- Crear estructura base `src/common/`, `src/config/`, `src/modules/`.
- Agregar módulos placeholder del MVP con imports ordenados en `app.module.ts`.
- Definir configuración Nest estricta y extensible sin conectar infraestructura todavía.
- Añadir contexto mínimo OpenSpec del stack si hace falta para fases siguientes.

### Out of Scope
- Entidades TypeORM, migraciones, conexión PostgreSQL/pgvector.
- JWT, roles, guards reales, endpoints productivos.
- BullMQ, Redis workers, health checks, logging estructurado.
- Lógica SECOP, scoring, LLM o frontend.

## Capabilities

### New Capabilities
- `backend-modular-foundation`: estructura base NestJS, módulos placeholder, convenciones de imports y configuración inicial para soportar el MVP.

### Modified Capabilities
- None — no existen specs previas en `openspec/specs/`.

## Approach

Crear un esqueleto modular simple: `common` para cross-cutting concerns, `config` para factories/options, y `modules` para dominios del MVP. Cada módulo arranca como placeholder compilable, sin comportamiento falso. `AppModule` queda como composición explícita y ordenada. Config estricta queda preparada para ANC-62/64, pero sin adelantar infraestructura.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/nest/src/common/` | New | Base para decorators, filters, guards, interceptors, pipes compartidos. |
| `apps/nest/src/config/` | New | Configuración base y estructura para env/database/queues/LLM futuros. |
| `apps/nest/src/modules/` | New/Modified | Placeholders para módulos MVP: auth, convocatorias, companies, scoring, llm, jobs/audit. |
| `apps/nest/src/app.module.ts` | Modified | Imports organizados de módulos base. |
| `apps/nest/tsconfig*.json`, lint/format config | Modified | Asegurar configuración estricta si está incompleta. |
| `openspec/config.yaml` | Modified | Contexto mínimo del proyecto para SDD, si sigue vacío. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Sobre-diseñar módulos antes de dominio real | Medium | Solo placeholders compilables; nada de lógica prematura. |
| Chocar con configuración existente | Low | Revisar archivos actuales antes de editar. |
| OpenSpec sin contexto afecta fases siguientes | Medium | Agregar contexto mínimo si falta. |

## Rollback Plan

Revertir archivos/directorios creados para ANC-61 y restaurar `app.module.ts`/config a su estado previo. Como no hay datos ni migraciones, rollback es solo de código.

## Dependencies

- Scaffold NestJS existente en `apps/nest/`.
- Arquitectura MVP definida en `docs/plataforma-licitaciones-propuesta-tecnica.md`.
- ANC-62+ dependen de esta estructura para ubicar entidades, configs y módulos.

## Success Criteria

- [ ] `apps/nest/src/` expone estructura modular clara y coherente.
- [ ] Módulos placeholder importan sin dependencias circulares.
- [ ] `AppModule` refleja composición backend del MVP.
- [ ] No se implementa lógica fuera de ANC-61.
- [ ] OpenSpec tiene contrato suficiente para specs/diseño posteriores.

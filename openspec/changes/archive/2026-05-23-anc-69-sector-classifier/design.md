## Context

Para mejorar el emparejamiento entre perfiles de empresas licitadoras y las convocatorias públicas del SECOP, el sistema debe ser capaz de determinar a qué sector de negocio pertenece cada convocatoria. Este análisis se realizará basándose en palabras clave contenidas en el título/objeto de la convocatoria.

## Goals / Non-Goals

**Goals:**
- Crear la estructura de base de datos para almacenar palabras clave asociadas a sectores.
- Diseñar e implementar un algoritmo de coincidencia de palabras clave por peso (`SectorClassifierService`).
- Automatizar la clasificación durante la ingesta masiva (dentro del BullMQ sandboxed worker `import-processor`).
- Exponer un endpoint REST para permitir la reclasificación manual de registros individuales.
- Proveer semillas de sectores comunes (Salud, TI, Infraestructura, Educación, Alimentos, Transporte, Servicios, Financiero).

**Non-Goals:**
- Implementar clasificadores basados en inteligencia artificial (NLP/LLM) en esta fase (se utilizará un clasificador determinista por reglas).
- Clasificación multi-sectorial (cada convocatoria tendrá exactamente un sector asignado o "Otros").

## Decisions

### 1. Ingesta Eficiente en el Worker de BullMQ
**Decisión**: Cargar todo el catálogo de `sector_keywords` en memoria al inicio de cada lote (batch) de ingesta en `import-processor.ts`, en lugar de hacer consultas individuales para cada fila.
**Razón**: Dado que `import-processor.ts` se ejecuta de forma aislada (sandboxed) en hilos de Bun y procesa miles de registros simultáneamente, consultar la base de datos por cada registro destruiría el rendimiento. Cargar las reglas en memoria una sola vez por lote mantiene el tiempo de procesamiento en milisegundos.

### 2. Algoritmo de Keyword Scoring
**Decisión**: Implementar el algoritmo **Keyword Scoring** con la siguiente lógica:
- **Normalización**: El título de la convocatoria se convierte a minúsculas y se remueven caracteres especiales (acentos, puntuación) para asegurar consistencia.
- **Cálculo de Puntuación**: Para cada sector $S$, se sumará el peso (`weight`) de cada una de sus palabras clave que aparezcan en el título normalizado.
- **Selección del Sector**: Se asignará el sector con la puntuación acumulada más alta.
- **Resolución de Empates**: Si dos o más sectores empatan con la puntuación máxima, se seleccionará el primero alfabéticamente.
- **Fallback a "Otros"**: Si la puntuación máxima es 0 (ninguna palabra clave coincidió), se asignará `"Otros"`.

### 3. Modelo de Datos y Relaciones
**Tabla `sector_keywords`**:
- `id`: UUID (Primary Key)
- `sector`: varchar (50) — Nombre del sector (ej. "SALUD", "TI")
- `keyword`: varchar (100) — Palabra clave a buscar
- `weight`: decimal (3, 2) — Peso de la palabra clave (ej. 1.00, 0.50)
- Restricción única en `(sector, keyword)`.

**Columna en `procurement_notices`**:
- `sector`: varchar (50), nullable — Almacena el sector clasificado.

## Risks / Trade-offs

- **[Riesgo] Coincidencias falsas (False Positives)**: Palabras clave genéricas pueden clasificar incorrectamente.
- **[Mitigación]**: Uso de pesos (`weight`) para dar más valor a términos muy específicos (ej. "marcapasos" vs "servicio").
- **[Trade-off]**: El clasificador por palabras clave es más rápido y sencillo que un clasificador semántico basado en embeddings, pero carece de análisis contextual profundo. Se prioriza rendimiento e implementación local.

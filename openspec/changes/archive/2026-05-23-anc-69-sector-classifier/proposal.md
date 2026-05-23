## Why

La plataforma SECOP Agent necesita categorizar de manera automática las convocatorias públicas en sectores industriales específicos (por ejemplo: Salud, Infraestructura, TI). Esto permitirá emparejar de forma efectiva las ofertas con los perfiles y capacidades de las empresas registradas. Actualmente, las convocatorias no tienen ninguna clasificación sectorial y la entidad `ProcurementNotice` no almacena esta información.

## What Changes

- **Columna `sector`**: Se añadirá la columna `sector` (nullable) a la tabla `procurement_notices` y a la entidad `ProcurementNotice`.
- **Tabla `sector_keywords`**: Nueva entidad `SectorKeyword` y tabla `sector_keywords` para almacenar las palabras clave y pesos por sector.
- **`SectorClassifierService` (Keyword Scoring)**: Servicio centralizado que implementa el algoritmo **Keyword Scoring** para clasificar convocatorias basándose en el acumulado de pesos de palabras clave coincidentes.
- **Fallback a "Otros"**: Si ninguna palabra clave coincide o la puntuación acumulada máxima es cero, la convocatoria se clasifica bajo el sector `"Otros"`.
- **Integración con Ingesta**: El procesador `import-processor.ts` ejecutará la clasificación antes de insertar/actualizar registros en la base de datos.
- **API Endpoint**: Endpoint `POST /procurement-notices/:id/classify` para re-clasificar manualmente una convocatoria y obtener el detalle de la puntuación.
- **Seeds de Sectores**: Carga inicial de datos para al menos 8 sectores con sus palabras clave representativas.

## Capabilities

### New Capabilities
- `sector-classification`: Clasificación automática de convocatorias basada en palabras clave del título (`title` / `objeto_a_contratar`) y endpoint para clasificación manual.

### Modified Capabilities
- Ninguna.

## Impact

- **Base de Datos**: Nueva migración para crear `sector_keywords` y alterar la tabla `procurement_notices` añadiendo la columna `sector`.
- **Backend (NestJS)**:
  - Modificación en `apps/nest/src/modules/procurement-notices/` para incorporar el nuevo endpoint y lógica.
  - Modificación en el procesador BullMQ `import-processor.ts` para integrar la clasificación automática.

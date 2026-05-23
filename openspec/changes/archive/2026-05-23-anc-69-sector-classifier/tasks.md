## 1. Persistencia y Modelado

- [x] 1.1 Crear la entidad `SectorKeyword` en `apps/nest/src/modules/procurement-notices/entities/sector-keyword.entity.ts` con campos: id (UUID), sector, keyword, weight.
- [x] 1.2 Registrar `SectorKeyword` en `apps/nest/src/config/typeorm.options.ts` y `apps/nest/src/data-source.ts`.
- [x] 1.3 Agregar campo `sector` a la entidad `ProcurementNotice` en `procurement-notice.entity.ts`.
- [x] 1.4 Generar e implementar la migración de base de datos para crear la tabla `sector_keywords`, añadir el campo `sector` a `procurement_notices` y poblar los keywords iniciales de los 8 sectores (Salud, TI, Infraestructura, Educación, Alimentos, Transporte, Servicios, Financiero).

## 2. Servicio de Clasificación

- [x] 2.1 Crear `SectorClassifierService` en `apps/nest/src/modules/procurement-notices/services/sector-classifier.service.ts` para contener el algoritmo de scoring y tokenización básica de textos.

## 3. Integración con Ingesta (Batch Ingestion)

- [x] 3.1 Modificar `apps/nest/src/modules/queues/processors/import-processor.ts` para que cargue todos los `sector_keywords` en memoria una vez por lote, ejecute la clasificación en cada registro mapeado y asigne el sector antes de realizar la inserción/upsert.

## 4. API Endpoint

- [x] 4.1 Modificar `ProcurementNoticesController` para exponer el endpoint `POST /procurement-notices/:id/classify`.
- [x] 4.2 Implementar en `ProcurementNoticesService` el método de clasificación manual, que calcule el score, persista el sector en la base de datos y retorne la convocatoria actualizada con los resultados del scoring detallado.

## 5. Pruebas

- [x] 5.1 Crear pruebas unitarias para `SectorClassifierService` y verificar el comportamiento de coincidencia por pesos y fallback.
- [x] 5.2 Correr el conjunto completo de pruebas con `bun run --cwd apps/nest test` para validar que todo funcione.

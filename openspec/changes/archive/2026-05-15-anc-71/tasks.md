## 1. Configuración de entorno y módulo

- [x] 1.1 Agregar `SODA_API_URL`, `SODA_APP_TOKEN`, `SODA_DATASET_SECOP1`, `SODA_DATASET_SECOP2`, `SODA_PAGE_SIZE`, `SODA_CRON` al `.env.example`
- [x] 1.2 Agregar variables SODA al schema de validación `config/env.validation.ts`
- [x] 1.3 Crear `config/soda.config.ts` con factory que lee las variables SODA
- [x] 1.4 Crear `modules/soda-ingestion/soda-ingestion.module.ts` con imports: `ScheduleModule`, `HttpModule`, `ProcurementNoticesModule`
- [x] 1.5 Registrar `SodaIngestionModule` en `AppModule`
- [x] 1.6 Registrar entidades nuevas en `typeorm.options.ts` y `data-source.ts` si aplica

## 2. SodaClientService — HTTP + paginación + reintentos

- [x] 2.1 Crear `services/soda-client.service.ts` con `@Injectable()`
- [x] 2.2 Implementar `buildUrl(datasetId: string): string` que construye el endpoint SODA 3.0
- [x] 2.3 Implementar `fetchPage(datasetId, offset, pageSize, whereClause?)` con header `X-App-Token`
- [x] 2.4 Agregar reintentos con backoff exponencial (1s, 2s, 4s) para errores de red y 5xx
- [x] 2.5 Implementar `paginateDataset(datasetId, whereClause?)` que itera páginas hasta recibir menos de `pageSize` registros
- [x] 2.6 Tests unitarios para `SodaClientService` con mocks de `HttpService`

## 3. Mappers estáticos SODA → ProcurementNoticeDto

- [x] 3.1 Verificar columnas reales de SECOP-I (`f789-7hwg`) y SECOP-II (`p6dx-8zbt`) contra `ProcurementNoticeDto` y documentar mapeo en comentarios
- [x] 3.2 Crear `mappers/secop-i.mapper.ts` con función pura `mapSecopI(raw): CreateProcurementNoticeDto`
- [x] 3.3 Crear `mappers/secop-ii.mapper.ts` con función pura `mapSecopII(raw): CreateProcurementNoticeDto`
- [x] 3.4 Definir interfaces `SecopIRecord` y `SecopIIRecord` en `soda-ingestion.types.ts`
- [x] 3.5 Tests unitarios para `mapSecopI` con fixture de respuesta SODA real de SECOP-I
- [x] 3.6 Tests unitarios para `mapSecopII` con fixture de respuesta SODA real de SECOP-II

## 4. SodaIngestionService — orquestación del ciclo

- [x] 4.1 Crear `services/soda-ingestion.service.ts` con `@Injectable()`
- [x] 4.2 Implementar `runIngestionCycle()` que lanza `fetchAndIngest(SECOP_I)` y `fetchAndIngest(SECOP_II)` con `Promise.allSettled`
- [x] 4.3 Implementar `fetchAndIngest(datasetId, source)` que pagina, mapea y llama `bulkUpsert()` por lotes de 500
- [x] 4.4 Agregar guard de ciclo concurrente: si `isRunning === true`, loguear WARNING y retornar sin ejecutar
- [x] 4.5 Implementar contador de fallos consecutivos por dataset con reset en éxito
- [x] 4.6 Emitir log ERROR cuando un dataset acumula 3 fallos consecutivos
- [x] 4.7 Persistir `lastRunTimestamp` por dataset en memoria (o Redis si disponible) para ingesta incremental
- [x] 4.8 Construir `$where` clause con `lastRunTimestamp` para ingestas incrementales; omitir en primera ejecución
- [x] 4.9 Tests unitarios para `SodaIngestionService` con mocks de `SodaClientService` y `ProcurementNoticesService`

## 5. Scheduler cron

- [x] 5.1 Agregar `@Cron()` decorator en `SodaIngestionService` usando `SODA_CRON` env var (default `0 */6 * * *`)
- [x] 5.2 Verificar que `ScheduleModule.forRoot()` está registrado en `SodaIngestionModule`
- [x] 5.3 Test: verificar que el método decorado con `@Cron` existe y es invocable

## 6. Tests de integración

- [x] 6.1 Test: ciclo completo con mock SODA — SECOP-I y SECOP-II paginan y persisten en DB
- [x] 6.2 Test: fallo de SECOP-I no interrumpe SECOP-II (`Promise.allSettled`)
- [x] 6.3 Test: guard de ciclo concurrente — segundo ciclo se saltea si el primero sigue corriendo
- [x] 6.4 Test: contador de fallos consecutivos llega a 3 y emite log ERROR
- [x] 6.5 Test: `lastRunTimestamp` se actualiza tras ciclo exitoso y se usa en el siguiente ciclo

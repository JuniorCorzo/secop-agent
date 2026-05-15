## MODIFIED Requirements

### Requirement: Scheduler interno NestJS
El sistema SHALL ejecutar un ciclo de ingesta SODA cada 6 horas usando `@nestjs/schedule`, sin depender de agentes externos.

#### Scenario: Ciclo automático exitoso
- **WHEN** el cron dispara el ciclo de 6 horas
- **THEN** el sistema lanza consultas paralelas a SECOP-I y SECOP-II
- **AND** persiste los registros normalizados directamente en PostgreSQL

#### Scenario: Ciclo anterior aún en ejecución
- **WHEN** el cron dispara un nuevo ciclo y el anterior no ha terminado
- **THEN** el nuevo ciclo se saltea con log WARNING
- **AND** el ciclo en curso continúa sin interrupción

#### Scenario: Un dataset falla, el otro continúa
- **WHEN** SECOP-I falla durante el ciclo
- **THEN** SECOP-II continúa y completa su ingesta normalmente
- **AND** el fallo de SECOP-I se registra en el log sin cancelar el ciclo completo

### Requirement: Paginación incremental por dataset
El sistema SHALL paginar cada dataset con `pageSize: 5000`, filtrando por `fecha_de_ultima_publicaci > lastRunTimestamp` para ingestas incrementales. En la primera ejecución realiza full scan.

#### Scenario: Primera ejecución — full scan
- **WHEN** no existe `lastRunTimestamp` para un dataset
- **THEN** el sistema pagina desde el inicio sin filtro de fecha
- **AND** persiste todos los registros disponibles

#### Scenario: Ejecución incremental
- **WHEN** existe `lastRunTimestamp` para un dataset
- **THEN** el sistema filtra registros con `fecha_de_ultima_publicaci > lastRunTimestamp`
- **AND** solo pagina y persiste los registros actualizados desde el último ciclo exitoso

#### Scenario: Dataset con múltiples páginas
- **WHEN** una página devuelve exactamente `pageSize` registros
- **THEN** el sistema solicita la página siguiente
- **AND** continúa hasta recibir una página con menos de `pageSize` registros

### Requirement: Mapeo estático SODA → ProcurementNoticeDto
El sistema SHALL mapear los campos de respuesta SODA al contrato `ProcurementNoticeDto` mediante funciones puras de mapeo estático, sin procesamiento semántico ni IA.

#### Scenario: Registro SECOP-I mapeado
- **WHEN** el sistema recibe un registro raw de SECOP-I (`f789-7hwg`)
- **THEN** aplica `mapSecopI(raw)` y produce un `ProcurementNoticeDto` válido
- **AND** campos ausentes en SECOP-I se mapean como `null`

#### Scenario: Registro SECOP-II mapeado
- **WHEN** el sistema recibe un registro raw de SECOP-II (`p6dx-8zbt`)
- **THEN** aplica `mapSecopII(raw)` y produce un `ProcurementNoticeDto` válido
- **AND** campos ausentes en SECOP-II se mapean como `null`

### Requirement: Reintentos con backoff exponencial
El sistema SHALL reintentar cada request SODA fallido hasta 3 veces con backoff exponencial antes de contar el intento como fallo de ciclo.

#### Scenario: Fallo transitorio recuperado
- **WHEN** un request SODA falla con error de red o 5xx
- **THEN** el sistema reintenta con espera exponencial (1s, 2s, 4s)
- **AND** si algún reintento tiene éxito, el ciclo continúa normalmente

#### Scenario: Fallo persistente tras 3 reintentos
- **WHEN** los 3 reintentos fallan
- **THEN** el sistema registra el fallo en el log con nivel ERROR
- **AND** el dataset se marca como fallido para ese ciclo

### Requirement: Health check por dataset
El sistema SHALL emitir una alerta si un dataset acumula 3 fallos consecutivos de ciclo completo.

#### Scenario: Alerta por fallos consecutivos
- **WHEN** un dataset falla en 3 ciclos consecutivos sin éxito intermedio
- **THEN** el sistema emite log ERROR con detalle del dataset y número de fallos
- **AND** continúa intentando en el siguiente ciclo programado

#### Scenario: Reset del contador tras éxito
- **WHEN** un ciclo de dataset completa exitosamente
- **THEN** el contador de fallos consecutivos de ese dataset se resetea a 0
- **AND** se persiste el `lastRunTimestamp` del ciclo exitoso

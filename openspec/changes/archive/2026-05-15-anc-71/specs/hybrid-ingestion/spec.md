## MODIFIED Requirements

### Requirement: Bulk Submission Contract
El sistema MUST exponer `POST /procurement-notices/bulk` para ingestas manuales o externas. La ingesta automática ahora la realiza el scheduler interno de NestJS directamente — no depende de clientes externos como Hermes.

#### Scenario: Ingesta automática interna
- **WHEN** el scheduler interno completa un ciclo de paginación SODA
- **THEN** los registros normalizados se persisten vía `bulkUpsert()` directamente
- **AND** no se usa el endpoint HTTP interno (evita overhead de red innecesario)

#### Scenario: Ingesta manual vía endpoint
- **WHEN** un cliente autorizado envía un batch normalizado a `POST /procurement-notices/bulk`
- **THEN** el sistema acepta el batch para ingesta asíncrona
- **AND** retorna un job identifier para inspección posterior

#### Scenario: Batch inválido rechazado
- **WHEN** un cliente envía registros malformados o excede los límites del batch
- **THEN** el sistema rechaza el request antes de encolar trabajo
- **AND** no ocurren efectos secundarios de ingesta

## ADDED Requirements

### Requirement: Algoritmo de Keyword Scoring
El sistema MUST clasificar cada convocatoria usando el algoritmo **Keyword Scoring**, sumando los pesos de todas las palabras clave coincidentes en el texto.

#### Scenario: Coincidencia de múltiples palabras de un mismo sector
- **GIVEN** las palabras clave "medicamento" (peso 1.0) y "quirúrgico" (peso 0.8) registradas para "SALUD".
- **WHEN** se clasifica una convocatoria con título "Suministro de medicamento y material quirúrgico".
- **THEN** la puntuación de "SALUD" es 1.8 y se selecciona este sector.

#### Scenario: Coincidencia en múltiples sectores (mayor puntuación gana)
- **GIVEN** la palabra "software" (peso 1.0) para "TI", y la palabra "soporte" (peso 0.3) para "SERVICIOS".
- **WHEN** se clasifica una convocatoria con título "Soporte técnico y software de gestión".
- **THEN** el sistema calcula score de 1.0 para "TI" y 0.3 para "SERVICIOS", seleccionando el sector "TI".

### Requirement: Clasificación Automática de Sectores en Ingesta
El sistema MUST clasificar automáticamente el sector de cada convocatoria durante el proceso de ingesta masiva (batch) analizando el campo `title`.

#### Scenario: Clasificación exitosa por coincidencia
- **GIVEN** la palabra clave "medicamento" registrada para el sector "SALUD" con peso 1.0.
- **WHEN** se ingesta una convocatoria con título "Suministro de medicamento hospitalario".
- **THEN** la convocatoria es persistida con el campo `sector` asignado como `"SALUD"`.

#### Scenario: Fallback a sector por defecto
- **GIVEN** que ninguna de las palabras clave registradas coincide con el título de la convocatoria.
- **WHEN** se ingesta una convocatoria con título "Servicio de consultoría general no especificado".
- **THEN** la convocatoria es persistida con el campo `sector` asignado como `"Otros"`.

### Requirement: Re-Clasificación Manual vía API
El sistema MUST permitir re-clasificar de forma manual una convocatoria específica mediante un endpoint POST y retornar el resultado detallado de las puntuaciones por sector.

#### Scenario: Re-clasificación manual exitosa
- **GIVEN** una convocatoria existente con ID `"notice-uuid-1"` y título "Desarrollo de software y licenciamiento de plataforma".
- **WHEN** se envía una petición POST a `/procurement-notices/notice-uuid-1/classify`.
- **THEN** el sistema calcula las puntuaciones de cada sector usando Keyword Scoring, actualiza el sector en base de datos a `"TI"` y retorna la convocatoria actualizada junto con el desglose de puntuaciones.

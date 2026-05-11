# Propuesta: Datos Relevantes de SECOP para Búsqueda de Licitaciones

> **Dataset:** SECOP Integrado (`rpmr-utcd`)
> **Registros:** ~21.8 millones de procesos de contratación pública en Colombia
> **API:** SODA 3.0 sobre datos.gov.co

---

## 1. Objetivo de Negocio

Una empresa que busca participar en licitaciones públicas necesita responder tres preguntas fundamentales:

1. **¿Qué oportunidades hay ahora?** — procesos abiertos donde pueda presentar ofertas
2. **¿Qué vale la pena perseguir?** — análisis del mercado, montos, competidores, entidades
3. **¿Con quién compito?** — inteligencia sobre contratistas que ya operan en el sector

El dataset SECOP Integrado permite responder las tres.

---

## 2. Columnas Clasificadas por Utilidad

### 🔴 Críticas — Imprescindibles para cualquier análisis

| Columna | Tipo | Valor para la empresa |
|---------|------|----------------------|
| `estado_del_proceso` | text | **Filtro #1.** Identifica procesos abiertos (`Convocado`), en ejecución, celebrados, etc. |
| `objeto_a_contratar` | text | **Keyword search.** ¿El contrato es relevante para mi sector? Búsqueda full-text. |
| `valor_contrato` | number | **Filtro económico.** ¿Está dentro de mi capacidad? Análisis de rentabilidad. |
| `fecha_de_firma_del_contrato` | timestamp | **Ventana temporal.** ¿Cuándo se cierra? Tendencias estacionales. |
| `fecha_inicio_ejecuci_n` | timestamp | **Timing.** ¿Cuándo necesito empezar? |
| `nombre_de_la_entidad` | text | **Quién compra.** ¿Qué entidad está contratando? Relación histórica. |
| `modalidad_de_contrataci_n` | text | **Tipo de proceso.** ¿Contratación directa? ¿Licitación pública? ¿Mínima cuantía? Estrategia de participación. |

### 🟡 Alta Utilidad — Contexto y segmentación

| Columna | Tipo | Valor para la empresa |
|---------|------|----------------------|
| `departamento_entidad` | text | **Geolocalización.** ¿Dónde está la oportunidad? |
| `municipio_entidad` | text | **Segmentación fina.** Oportunidades locales vs nacionales. |
| `tipo_de_contrato` | text | **Naturaleza.** ¿Prestación de servicios, suministro, obra, consultoría? |
| `nom_raz_social_contratista` | text | **Competencia.** ¿Quién ganó contratos similares? Inteligencia competitiva. |
| `documento_proveedor` | text | **Identidad del competidor.** Cruzar con otras fuentes. |
| `nivel_entidad` | text | **Alcance.** ¿Nacional, territorial, corporación autónoma? |
| `origen` | text | **Plataforma.** ¿SECOP I o SECOP II? Cambia la estrategia. |

### 🟢 Utilidad Media — Referencia y trazabilidad

| Columna | Tipo | Valor para la empresa |
|---------|------|----------------------|
| `numero_del_contrato` | text | **Trazabilidad.** ID para seguimiento. |
| `numero_de_proceso` | text | **Referencia.** ID del proceso en la plataforma. |
| `url_contrato` | text | **Link directo.** Ir a la publicación oficial. |
| `nit_de_la_entidad` | text | **Identificación fiscal.** Cruce con otros sistemas. |
| `codigo_entidad_en_secop` | text | **Código interno.** Seguimiento automatizado. |
| `objeto_del_proceso` | text | **Descripción alternativa.** A veces más detalle que `objeto_a_contratar`. |
| `fecha_fin_ejecuci_n` | timestamp | **Duración del contrato.** Planificación de recursos. |
| `tipo_documento_proveedor` | text | **Tipo de competidor.** ¿Persona natural o jurídica? |

---

## 3. Flujos de Consulta por Caso de Uso

### 3.1 Alerta Temprana: Detección de Oportunidades Abiertas

**Objetivo:** Encontrar procesos en estado `Convocado` que coincidan con palabras clave del sector de la empresa.

```sql
SELECT
  nombre_de_la_entidad,
  objeto_a_contratar,
  valor_contrato,
  modalidad_de_contrataci_n,
  departamento_entidad,
  municipio_entidad,
  fecha_de_firma_del_contrato,
  url_contrato
WHERE
  estado_del_proceso = 'Convocado'
  AND objeto_a_contratar LIKE '%KEYWORD%'
ORDER BY
  fecha_de_firma_del_contrato DESC
```

**Queries SoQL equivalentes (ejemplos sectoriales):**

```bash
# Sector Salud
WHERE estado_del_proceso = 'Convocado'
  AND (objeto_a_contratar LIKE '%medicamento%'
    OR objeto_a_contratar LIKE '%hospital%'
    OR objeto_a_contratar LIKE '%salud%'
    OR objeto_a_contratar LIKE '%farmacéutico%')

# Sector Construcción / Obra
WHERE estado_del_proceso = 'Convocado'
  AND (objeto_a_contratar LIKE '%obra%'
    OR objeto_a_contratar LIKE '%construcción%'
    OR objeto_a_contratar LIKE '%infraestructura%'
    OR objeto_a_contratar LIKE '%mantenimiento%'
    OR tipo_de_contrato = 'Obra')

# Sector TI / Tecnología
WHERE estado_del_proceso = 'Convocado'
  AND (objeto_a_contratar LIKE '%software%'
    OR objeto_a_contratar LIKE '%sistema%'
    OR objeto_a_contratar LIKE '%tecnología%'
    OR objeto_a_contratar LIKE '%computador%'
    OR objeto_a_contratar LIKE '%TIC%'
    OR objeto_a_contratar LIKE '%digital%')

# Sector Consultoría
WHERE estado_del_proceso = 'Convocado'
  AND tipo_de_contrato = 'Consultoría'

# Sector Alimentos / Catering
WHERE estado_del_proceso = 'Convocado'
  AND (objeto_a_contratar LIKE '%alimento%'
    OR objeto_a_contratar LIKE '%comedor%'
    OR objeto_a_contratar LIKE '%catering%'
    OR objeto_a_contratar LIKE '%restaurante%')
```

### 3.2 Análisis de Mercado: ¿Dónde está el dinero?

**Objetivo:** Identificar las entidades, departamentos y modalidades con mayor volumen de contratación.

```sql
-- Top entidades por monto total contratado
SELECT
  nombre_de_la_entidad,
  sum(valor_contrato) AS total_contratado,
  count(*) AS cantidad_contratos,
  avg(valor_contrato) AS promedio_contrato
GROUP BY nombre_de_la_entidad
ORDER BY total_contratado DESC

-- Top departamentos por monto (último año)
SELECT
  departamento_entidad,
  sum(valor_contrato) AS total_contratado,
  count(*) AS cantidad
WHERE date_extract_y(fecha_de_firma_del_contrato) = 2024
GROUP BY departamento_entidad
ORDER BY total_contratado DESC

-- Distribución por modalidad de contratación
SELECT
  modalidad_de_contrataci_n,
  count(*) AS cantidad,
  sum(valor_contrato) AS monto_total,
  avg(valor_contrato) AS monto_promedio
GROUP BY modalidad_de_contrataci_n
ORDER BY cantidad DESC

-- Tendencia mensual (estacionalidad)
SELECT
  date_extract_y(fecha_de_firma_del_contrato) AS anio,
  date_extract_m(fecha_de_firma_del_contrato) AS mes,
  count(*) AS contratos,
  sum(valor_contrato) AS monto_total
GROUP BY anio, mes
ORDER BY anio DESC, mes DESC
```

### 3.3 Inteligencia Competitiva: ¿Quién está ganando?

**Objetivo:** Identificar competidores activos en un sector y analizar su perfil.

```sql
-- Quién ganó contratos de mi sector (keyword) en el último año
SELECT
  nom_raz_social_contratista,
  tipo_documento_proveedor,
  count(*) AS contratos_ganados,
  sum(valor_contrato) AS monto_total,
  avg(valor_contrato) AS monto_promedio,
  max(valor_contrato) AS contrato_mas_grande
WHERE
  objeto_a_contratar LIKE '%KEYWORD%'
  AND date_extract_y(fecha_de_firma_del_contrato) >= 2023
GROUP BY nom_raz_social_contratista, tipo_documento_proveedor
ORDER BY monto_total DESC

-- Entidades donde compite un contratista específico
SELECT
  nombre_de_la_entidad,
  count(*) AS contratos,
  sum(valor_contrato) AS monto_total
WHERE
  nom_raz_social_contratista LIKE '%NOMBRE_COMPETIDOR%'
GROUP BY nombre_de_la_entidad
ORDER BY monto_total DESC

-- Modalidades donde opera un competidor
SELECT
  modalidad_de_contrataci_n,
  tipo_de_contrato,
  count(*) AS contratos,
  sum(valor_contrato) AS monto_total
WHERE
  nom_raz_social_contratista LIKE '%NOMBRE_COMPETIDOR%'
GROUP BY modalidad_de_contrataci_n, tipo_de_contrato
ORDER BY contratos DESC
```

### 3.4 Perfil de Entidad: ¿Cómo contrata?

**Objetivo:** Antes de participar, entender el comportamiento de contratación de una entidad específica.

```sql
-- ¿Cómo contrata esta entidad? (modalidades preferidas)
SELECT
  modalidad_de_contrataci_n,
  tipo_de_contrato,
  count(*) AS cantidad,
  avg(valor_contrato) AS monto_promedio
WHERE
  nombre_de_la_entidad LIKE '%NOMBRE_ENTIDAD%'
  AND date_extract_y(fecha_de_firma_del_contrato) >= 2022
GROUP BY modalidad_de_contrataci_n, tipo_de_contrato
ORDER BY cantidad DESC

-- ¿En qué meses contrata más?
SELECT
  date_extract_m(fecha_de_firma_del_contrato) AS mes,
  count(*) AS contratos,
  sum(valor_contrato) AS monto_total
WHERE
  nombre_de_la_entidad LIKE '%NOMBRE_ENTIDAD%'
  AND date_extract_y(fecha_de_firma_del_contrato) >= 2022
GROUP BY mes
ORDER BY mes

-- ¿Qué tipo de cosas compra? (objetos más frecuentes)
SELECT
  objeto_a_contratar,
  count(*) AS frecuencia
WHERE
  nombre_de_la_entidad LIKE '%NOMBRE_ENTIDAD%'
  AND date_extract_y(fecha_de_firma_del_contrato) >= 2022
GROUP BY objeto_a_contratar
ORDER BY frecuencia DESC
```

### 3.5 Oportunidades por Rango de Precio

**Objetivo:** Filtrar licitaciones que coincidan con la capacidad financiera de la empresa.

```sql
-- Micro-contratos (< $10M COP) — ideales para empresas pequeñas
WHERE estado_del_proceso = 'Convocado'
  AND valor_contrato < 10000000

-- Contratos pequeños ($10M - $100M COP)
WHERE estado_del_proceso = 'Convocado'
  AND valor_contrato BETWEEN 10000000 AND 100000000

-- Contratos medianos ($100M - $1000M COP)
WHERE estado_del_proceso = 'Convocado'
  AND valor_contrato BETWEEN 100000000 AND 1000000000

-- Grandes licitaciones (> $1000M COP)
WHERE estado_del_proceso = 'Convocado'
  AND valor_contrato > 1000000000
```

### 3.6 Geointeligencia: Oportunidades por Región

```sql
-- Oportunidades abiertas en un departamento específico
WHERE estado_del_proceso = 'Convocado'
  AND departamento_entidad = 'Antioquia'

-- Oportunidades abiertas en múltiples departamentos de interés
WHERE estado_del_proceso = 'Convocado'
  AND departamento_entidad IN('Antioquia', 'Cundinamarca', 'Valle del Cauca', 'Bogotá D.C.')

-- Top municipios con más contratación en mi sector
SELECT
  municipio_entidad,
  departamento_entidad,
  count(*) AS oportunidades,
  sum(valor_contrato) AS monto_total
WHERE
  objeto_a_contratar LIKE '%KEYWORD%'
  AND estado_del_proceso IN('Celebrado', 'Liquidado', 'En ejecución')
GROUP BY municipio_entidad, departamento_entidad
ORDER BY oportunidades DESC
```

---

## 4. Dashboard Recomendado: KPIs de Licitaciones

Un dashboard mínimo para una empresa cazadora de licitaciones debería incluir:

| KPI | Query SoQL | Frecuencia |
|-----|-----------|------------|
| **Oportunidades abiertas hoy** | `count(*) WHERE estado_del_proceso='Convocado'` | Diaria |
| **Oportunidades por sector (keyword)** | `count(*) WHERE estado_del_proceso='Convocado' AND objeto_a_contratar LIKE '%KEYWORD%'` | Diaria |
| **Valor total del mercado objetivo** | `sum(valor_contrato) WHERE estado_del_proceso='Convocado' AND objeto_a_contratar LIKE '%KEYWORD%'` | Semanal |
| **Top 5 entidades que más contratan (mi sector)** | Agregación por `nombre_de_la_entidad` + `sum(valor_contrato)` filtrado por sector | Mensual |
| **Competidores activos (mi sector)** | Agregación por `nom_raz_social_contratista` + `count(*)` | Mensual |
| **Tendencia de contratación anual** | `date_extract_y()` + `sum(valor_contrato)` agrupado por año | Trimestral |
| **Distribución por modalidad** | Agregación por `modalidad_de_contrataci_n` + `count(*)` | Trimestral |
| **Oportunidades por departamento** | Agregación por `departamento_entidad` + `count(*) WHERE estado='Convocado'` | Semanal |

---

## 5. Estrategia de Clasificación por Keywords

La columna `objeto_a_contratar` es texto libre. Para clasificar automáticamente las licitaciones por sector, se recomienda un sistema de reglas por keywords:

```
SECTOR_MAP = {
    "SALUD": [
        "medicamento", "hospital", "salud", "farmacéutico", "quirúrgico",
        "enfermer", "médico", "paciente", "clínica", "odontol", "EPS",
        "IPS", "vacuna", "laboratorio clínico", "ambulancia"
    ],
    "CONSTRUCCIÓN": [
        "obra", "construcción", "infraestructura", "vivienda", "edificación",
        "demolición", "adecuación", "remodelación", "paviment", "alcantarillado",
        "acueducto", "vía", "carretera", "puente", "colegio sede"
    ],
    "TECNOLOGÍA": [
        "software", "sistema de información", "tecnología", "computador",
        "servidor", "redes", "TIC", "digital", "página web", "desarrollo",
        "soporte técnico", "hardware", "licenciamiento", "datacenter"
    ],
    "CONSULTORÍA": [
        "consultoría", "asesor", "interventoría", "auditor", "estudio",
        "diagnóstico", "evaluación", "formulación", "estructuración"
    ],
    "ALIMENTOS": [
        "alimento", "restaurante", "comedor", "catering", "nutrición",
        "desayuno", "almuerzo", "refrigerio", "ración", "víveres",
        "cárnicos", "lácteos", "fruta", "verdura", "panadería"
    ],
    "TRANSPORTE": [
        "transporte", "vehículo", "automotor", "bus", "camión",
        "movilidad", "logística", "mensajería", "carga", "pasajeros",
        "escolar", "flota"
    ],
    "ASEO Y MANTENIMIENTO": [
        "aseo", "limpieza", "mantenimiento", "jardinería", "fumigación",
        "desinfección", "recolección de residuos", "basura"
    ],
    "SEGURIDAD": [
        "vigilancia", "seguridad", "escolta", "cámara de seguridad",
        "monitoreo", "alarma", "guarda de seguridad"
    ],
    "PAPELERÍA E INSUMOS": [
        "papelería", "útil", "oficina", "insumo", "suministro",
        "tóner", "impresión", "material didáctico"
    ],
}
```

La clasificación se puede hacer en dos pasos:
1. **Query SoQL** con `LIKE` para pre-filtrar candidatos (reduce el volumen)
2. **Post-procesamiento** en Python/JS con regex para clasificación fina y scoring de relevancia

---

## 6. Arquitectura Propuesta para el Sistema

```
┌─────────────────────────────────────────────────────┐
│                   SECOP Agent                        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────┐ │
│  │ SODA Fetcher │   │  Classifier  │   │ Alert    │ │
│  │ (API 3.0)    │──▶│  (keywords)  │──▶│ Engine   │ │
│  └──────────────┘   └──────────────┘   └──────────┘ │
│         │                                    │       │
│         ▼                                    ▼       │
│  ┌──────────────┐                    ┌──────────┐   │
│  │ Local Cache  │                    │ Notify   │   │
│  │ (SQLite/JSON)│                    │ (email,  │   │
│  └──────────────┘                    │  slack)  │   │
│                                      └──────────┘   │
└─────────────────────────────────────────────────────┘
```

**Componentes clave:**

1. **SODA Fetcher:** Cliente HTTP para SODA 3.0. Ejecuta queries SoQL, maneja paginación y errores.
2. **Classifier:** Motor de clasificación por keywords. Toma `objeto_a_contratar` y asigna sector(es) con scoring de confianza.
3. **Local Cache:** Almacena resultados para no repetir consultas. Diffs entre ejecuciones para detectar novedades.
4. **Alert Engine:** Compara resultados nuevos vs cache. Si encuentra procesos `Convocado` nuevos → dispara notificación.

---

## 7. Plan de Implementación (Fases)

### Fase 1: Monitoreo Básico (MVP)
- [ ] Obtener app token de datos.gov.co
- [ ] Implementar cliente SODA 3.0 (POST a `/query`)
- [ ] Query diaria: `WHERE estado_del_proceso = 'Convocado'`
- [ ] Clasificación básica por keywords
- [ ] Salida: CSV o notificación simple

### Fase 2: Enriquecimiento
- [ ] Histórico de la entidad (¿cómo contrata?)
- [ ] Análisis de competidores en el sector
- [ ] Estacionalidad (¿cuándo publican más?)
- [ ] Scoring de oportunidad (valor + entidad + competencia)

### Fase 3: Automatización
- [ ] Ejecución programada (cron / scheduled task)
- [ ] Alertas por email/Slack/WhatsApp
- [ ] Dashboard web con KPIs
- [ ] Detección de cambios de estado (Convocado → Adjudicado → Celebrado)

---

## 8. Columnas NO relevantes para el caso de uso

Estas columnas tienen poco o nulo valor para búsqueda de licitaciones:

| Columna | Por qué no es relevante |
|---------|------------------------|
| `codigo_entidad_en_secop` | Código interno, útil solo para automatización avanzada |
| `nit_de_la_entidad` (cuando es `NO DEFINIDO`) | ~1.2M de registros tienen NIT no definido |
| `tipo_documento_proveedor` | Solo relevante para clasificar competidores (persona natural vs jurídica) |
| `documento_proveedor` | Dato sensible. Útil solo para cruce con otras bases |

---

## 9. Consideraciones Técnicas

### Volumen de datos
- **21.8M registros** totales. Las queries sin filtrar son inviables.
- **Estrategia:** Siempre filtrar por `estado_del_proceso` y/o `fecha` primero. Una query con `WHERE estado_del_proceso = 'Convocado'` reduce drásticamente el volumen (~971K registros históricos, pero los activos son muchos menos).

### Frecuencia de actualización
- El dataset se actualiza periódicamente (campo `rowsUpdatedAt` en metadata).
- Para alertas, frecuencia diaria es suficiente. La mayoría de procesos tienen ventanas de semanas.

### Límites de la API
- App token obligatorio
- 50,000 filas por página
- Timeout de 600 segundos
- Sin límite duro de requests, pero throttling por abuso

### SoQL no soporta
- `JOIN` — no hay relaciones entre datasets
- Subqueries
- `DISTINCT` en texto (sí existe `distinct` como keyword pero con comportamiento limitado)
- Full-text search avanzado (solo `LIKE` y `starts_with`)

---

## 10. Referencias

- [Guía SODA 3.0 para SECOP](./socrata-soda-guide.md)
- [Dataset SECOP Integrado](https://www.datos.gov.co/Estad-sticas-Nacionales/SECOP-Integrado/rpmr-utcd)
- [API Documentation](https://dev.socrata.com/foundry/www.datos.gov.co/rpmr-utcd)
- [SoQL Functions Reference](https://dev.socrata.com/docs/functions/)

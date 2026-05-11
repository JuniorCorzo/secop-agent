# Guía de Uso: API Socrata SODA 3.0 — Portal datos.gov.co

> **Dataset de referencia:** SECOP Integrado (`rpmr-utcd`)
> **Portal:** https://www.datos.gov.co
> **Fuente:** Agencia Nacional de Contratación Pública — Colombia Compra Eficiente
> **Total registros:** ~21.8 millones
> **Plataforma:** Socrata / Tyler Technologies Data & Insights
> **Versión API:** SODA 3.0 (autenticación requerida)

---

## 1. Endpoints

SODA 3.0 introduce dos endpoints separados: `/query` para consultas programáticas y `/export` para descargas completas.

| Propósito | URL |
|-----------|-----|
| **Query** (JSON) | `POST https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json` |
| **Export** (CSV) | `POST https://www.datos.gov.co/api/v3/views/rpmr-utcd/export.csv` |
| **Metadata** | `GET https://www.datos.gov.co/api/views/rpmr-utcd.json` |
| **Documentación** | `https://dev.socrata.com/foundry/www.datos.gov.co/rpmr-utcd` |

### Diferencia clave con SODA 2.x

| | SODA 2.x | SODA 3.0 |
|---|---|---|
| Método HTTP | GET | **POST** |
| Parámetros | Query string (`$select`, `$where`, etc.) | JSON body |
| Autenticación | Opcional | **Obligatoria** (app token o usuario) |
| Paginación | `$limit` + `$offset` | `page: {pageNumber, pageSize}` |
| Endpoint | `/resource/{id}.json` | `/api/v3/views/{id}/query.json` |

---

## 2. App Token (Obligatorio en SODA 3.0)

En SODA 3.0 **todo request debe estar autenticado** con app token o credenciales de usuario.

### Obtención
1. Ir a https://www.datos.gov.co
2. Crear cuenta o iniciar sesión
3. Ir a tu perfil → **Developer Settings** → **Create New App Token**
4. Copiar el token generado

### Uso
El token se envía como header HTTP:

```bash
X-App-Token: TU_TOKEN_AQUI
```

**IMPORTANTE:** Sin app token, el endpoint SODA 3.0 devuelve:
```json
{
  "code": "authentication_required",
  "error": true,
  "message": "This request must be authenticated or have an application token"
}
```

---

## 3. SoQL: Socrata Query Language

SoQL es un subset de SQL. En SODA 3.0, la query va dentro del JSON body. **Ya no se usa el prefijo `$`**.

### 3.1 Estructura básica del request

```bash
curl -X POST "https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json" \
  -H "Content-Type: application/json" \
  -H "X-App-Token: TU_TOKEN" \
  -d '{
    "query": "SELECT *",
    "page": {
      "pageNumber": 1,
      "pageSize": 100
    },
    "includeSynthetic": false
  }'
```

### 3.2 SELECT — Seleccionar columnas

```bash
# Todas las columnas de usuario (no incluye system fields)
curl -X POST "https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json" \
  -H "Content-Type: application/json" \
  -H "X-App-Token: TU_TOKEN" \
  -d '{
    "query": "SELECT *",
    "page": {"pageNumber": 1, "pageSize": 5},
    "includeSynthetic": false
  }'

# Columnas específicas
curl -X POST "https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json" \
  -H "Content-Type: application/json" \
  -H "X-App-Token: TU_TOKEN" \
  -d '{
    "query": "SELECT nombre_de_la_entidad, valor_contrato, nom_raz_social_contratista",
    "page": {"pageNumber": 1, "pageSize": 5}
  }'

# Alias con AS
curl -X POST "https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json" \
  -H "Content-Type: application/json" \
  -H "X-App-Token: TU_TOKEN" \
  -d '{
    "query": "SELECT nombre_de_la_entidad AS entidad, valor_contrato AS valor, nom_raz_social_contratista AS contratista",
    "page": {"pageNumber": 1, "pageSize": 5}
  }'
```

### 3.3 WHERE — Filtrar datos

```bash
# Igualdad exacta (texto entre comillas simples)
curl -X POST "https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json" \
  -H "Content-Type: application/json" \
  -H "X-App-Token: TU_TOKEN" \
  -d '{
    "query": "SELECT * WHERE departamento_entidad = '"'"'Antioquia'"'"'",
    "page": {"pageNumber": 1, "pageSize": 5}
  }'

# NOTA: En bash, las comillas simples dentro del JSON requieren escape.
# Forma más limpia: usar archivo o heredoc (ver sección 6 de ejemplos)

# Mayor que (numérico)
curl ... -d '{"query": "SELECT * WHERE valor_contrato > 100000000", "page": {"pageNumber": 1, "pageSize": 5}}'

# AND / OR con paréntesis
curl ... -d '{
  "query": "SELECT * WHERE departamento_entidad = '"'"'Bogotá D.C.'"'"' AND valor_contrato > 50000000",
  "page": {"pageNumber": 1, "pageSize": 5}
}'

# IN (lista de valores)
curl ... -d '{
  "query": "SELECT * WHERE departamento_entidad IN('"'"'Antioquia'"'"','"'"'Bolívar'"'"','"'"'Caldas'"'"')",
  "page": {"pageNumber": 1, "pageSize": 5}
}'

# NOT IN
curl ... -d '{
  "query": "SELECT * WHERE departamento_entidad NOT IN('"'"'Antioquia'"'"','"'"'Bogotá D.C.'"'"')",
  "page": {"pageNumber": 1, "pageSize": 5}
}'

# BETWEEN (rangos numéricos)
curl ... -d '{
  "query": "SELECT * WHERE valor_contrato BETWEEN 10000000 AND 50000000",
  "page": {"pageNumber": 1, "pageSize": 5}
}'

# LIKE (substring)
curl ... -d '{
  "query": "SELECT * WHERE nombre_de_la_entidad LIKE '"'"'%UNIVERSIDAD%'"'"'",
  "page": {"pageNumber": 1, "pageSize": 5}
}'

# starts_with()
curl ... -d '{
  "query": "SELECT * WHERE starts_with(nombre_de_la_entidad, '"'"'ANTIOQUIA'"'"')",
  "page": {"pageNumber": 1, "pageSize": 5}
}'

# IS NULL / IS NOT NULL
curl ... -d '{
  "query": "SELECT * WHERE nit_de_la_entidad IS NOT NULL",
  "page": {"pageNumber": 1, "pageSize": 5}
}'
```

### 3.4 ORDER BY — Ordenar

```bash
# Ascendente (default)
curl ... -d '{"query": "SELECT * ORDER BY valor_contrato", "page": {"pageNumber": 1, "pageSize": 10}}'

# Descendente
curl ... -d '{"query": "SELECT * ORDER BY valor_contrato DESC", "page": {"pageNumber": 1, "pageSize": 10}}'

# Múltiples columnas
curl ... -d '{"query": "SELECT * ORDER BY departamento_entidad ASC, valor_contrato DESC", "page": {"pageNumber": 1, "pageSize": 10}}'
```

### 3.5 GROUP BY — Agrupar y agregar

```bash
# Contar contratos por departamento
curl ... -d '{
  "query": "SELECT departamento_entidad, count(*) AS total GROUP BY departamento_entidad ORDER BY total DESC",
  "page": {"pageNumber": 1, "pageSize": 10}
}'

# Suma de valores por departamento
curl ... -d '{
  "query": "SELECT departamento_entidad, sum(valor_contrato) AS total_valor GROUP BY departamento_entidad ORDER BY total_valor DESC",
  "page": {"pageNumber": 1, "pageSize": 10}
}'

# Promedio, máx, mín
curl ... -d '{
  "query": "SELECT departamento_entidad, avg(valor_contrato) AS promedio, max(valor_contrato) AS maximo, min(valor_contrato) AS minimo GROUP BY departamento_entidad",
  "page": {"pageNumber": 1, "pageSize": 10}
}'

# GROUP BY con HAVING
curl ... -d '{
  "query": "SELECT departamento_entidad, count(*) AS total GROUP BY departamento_entidad HAVING total > 100000 ORDER BY total DESC",
  "page": {"pageNumber": 1, "pageSize": 10}
}'
```

### 3.6 Paginación

En SODA 3.0, la paginación se controla con el objeto `page` en el JSON body — **NO** con `LIMIT`/`OFFSET` de SoQL (aunque SoQL también los soporta, la forma recomendada es `page`).

```bash
# Página 3, 100 resultados por página (filas 201-300)
curl ... -d '{
  "query": "SELECT * ORDER BY valor_contrato DESC",
  "page": {
    "pageNumber": 3,
    "pageSize": 100
  }
}'
```

**Parámetros de `page`:**
| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `pageNumber` | integer | 1 | Número de página (1-indexed) |
| `pageSize` | integer | 1000 | Filas por página |

> ⚠️ **Performance:** Páginas altas degradan mucho el rendimiento. Preferí filtrar con `WHERE` antes que paginar profundo.

### 3.7 Opciones de request (solo en `/query`)

```bash
curl ... -d '{
  "query": "SELECT * WHERE departamento_entidad = '"'"'Antioquia'"'"'",
  "page": {"pageNumber": 1, "pageSize": 100},
  "includeSystem": true,
  "includeSynthetic": false,
  "orderingSpecifier": "total",
  "timeout": 300
}'
```

| Opción | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `includeSystem` | boolean | true | Incluir columnas de sistema (`:id`, `:created_at`, etc.) |
| `includeSynthetic` | boolean | true | Incluir columnas no solicitadas explícitamente |
| `orderingSpecifier` | string | `"total"` | `"discard"` si no importa el orden (mejora performance) |
| `timeout` | integer | 600 | Timeout en segundos (máx 600 = 10 min) |

### 3.8 WHERE con fechas

```bash
# Filtro por fecha exacta
curl ... -d '{
  "query": "SELECT * WHERE fecha_de_firma_del_contrato = '"'"'2019-01-01T00:00:00'"'"'",
  "page": {"pageNumber": 1, "pageSize": 5}
}'

# Rango de fechas
curl ... -d '{
  "query": "SELECT * WHERE fecha_de_firma_del_contrato BETWEEN '"'"'2019-01-01T00:00:00'"'"' AND '"'"'2019-12-31T23:59:59'"'"'",
  "page": {"pageNumber": 1, "pageSize": 5}
}'

# Mayor/menor que fecha
curl ... -d '{
  "query": "SELECT * WHERE fecha_de_firma_del_contrato > '"'"'2023-01-01T00:00:00'"'"'",
  "page": {"pageNumber": 1, "pageSize": 5}
}'

# Funciones de extracción de fecha (año)
curl ... -d '{
  "query": "SELECT * WHERE date_extract_y(fecha_de_firma_del_contrato) = 2023",
  "page": {"pageNumber": 1, "pageSize": 5}
}'
```

---

## 4. Export endpoint

Para descargas completas (humano-legibles, CSV/Excel):

```bash
# Exportar como CSV
curl -X POST "https://www.datos.gov.co/api/v3/views/rpmr-utcd/export.csv" \
  -H "Content-Type: application/json" \
  -H "X-App-Token: TU_TOKEN" \
  -d '{
    "query": "SELECT departamento_entidad, valor_contrato WHERE departamento_entidad = '"'"'Antioquia'"'"'",
    "serializationOptions": {
      "separator": ",",
      "bom": true
    }
  }' > export.csv
```

**Opciones de serialización para CSV:**

| Opción | Descripción |
|--------|-------------|
| `separator` | Delimitador: `","`, `"\t"`, `"|"`, etc. |
| `bom` | Incluir Byte Order Mark (para Excel) |
| `quote` | Carácter de quoting (default `"`) |
| `escape` | Carácter de escape (default `\`) |

---

## 5. Funciones SoQL disponibles

### Agregación
| Función | Descripción | Ejemplo |
|---------|-------------|---------|
| `count(*)` | Contar registros | `SELECT count(*) AS total` |
| `sum(col)` | Suma de valores | `SELECT sum(valor_contrato)` |
| `avg(col)` | Promedio | `SELECT avg(valor_contrato)` |
| `min(col)` | Mínimo | `SELECT min(valor_contrato)` |
| `max(col)` | Máximo | `SELECT max(valor_contrato)` |
| `stddev_pop(col)` | Desviación estándar poblacional | `SELECT stddev_pop(valor_contrato)` |
| `stddev_samp(col)` | Desviación estándar muestral | `SELECT stddev_samp(valor_contrato)` |

### Texto
| Función | Descripción |
|---------|-------------|
| `lower(col)` | A minúsculas |
| `upper(col)` | A mayúsculas |
| `starts_with(col, 'texto')` | Empieza con |
| `col LIKE '%texto%'` | Contiene substring |
| `unaccent(col)` | Remueve tildes/diacríticos |
| `case(cond, val_true, val_false)` | Condicional |

### Fecha
| Función | Extrae |
|---------|--------|
| `date_extract_y(fecha)` | Año (integer) |
| `date_extract_m(fecha)` | Mes (1-12) |
| `date_extract_d(fecha)` | Día (1-31) |
| `date_extract_hh(fecha)` | Hora (0-23) |
| `date_extract_mm(fecha)` | Minutos (0-59) |
| `date_extract_ss(fecha)` | Segundos (0-59) |
| `date_extract_dow(fecha)` | Día de semana (0=domingo) |
| `date_extract_woy(fecha)` | Semana del año (0-51) |
| `date_trunc_y(fecha)` | Truncar a año |
| `date_trunc_ym(fecha)` | Truncar a año-mes |
| `date_trunc_ymd(fecha)` | Truncar a fecha |

### Comparación
| Función | Ejemplo |
|---------|---------|
| `col IN('a','b','c')` | Lista de valores |
| `col NOT IN(...)` | Exclusión |
| `col BETWEEN x AND y` | Rango inclusivo |
| `col NOT BETWEEN x AND y` | Fuera de rango |
| `col IS NULL` | Es nulo |
| `col IS NOT NULL` | No es nulo |
| `greatest(a,b)` | Mayor entre valores |
| `least(a,b)` | Menor entre valores |

### Operadores booleanos
| Operador | Ejemplo |
|----------|---------|
| `AND` | `a > 1 AND b = 'x'` |
| `OR` | `a = 'x' OR a = 'y'` |
| `NOT` | `NOT (a = 'x')` |
| `( )` | Agrupación: `(a = 1 OR a = 2) AND b > 3` |

### Estadísticas avanzadas
| Función | Descripción |
|---------|-------------|
| `regr_intercept(y, x)` | Intercepto Y de regresión lineal |
| `regr_r2(y, x)` | R² (coeficiente de determinación) |
| `regr_slope(y, x)` | Pendiente de regresión lineal |

### Geospaciales (no aplican a este dataset)
| Función | Descripción |
|---------|-------------|
| `within_box(col, lat1, lon1, lat2, lon2)` | Dentro de caja geográfica |
| `within_circle(col, lat, lon, meters)` | Dentro de círculo |
| `within_polygon(col, 'MULTIPOLYGON(...)')` | Dentro de polígono |
| `intersects(geo1, geo2)` | Intersección geométrica |
| `distance_in_meters(p1, p2)` | Distancia en metros entre dos puntos |
| `convex_hull(col)` | Envolvente convexa de geometrías |
| `extent(col)` | Bounding box de conjunto de geometrías |
| `simplify(col, tolerance)` | Simplificar geometría |
| `simplify_preserve_topology(col, tol)` | Simplificar preservando topología |
| `num_points(col)` | Número de vértices |

---

## 6. Estructura del dataset SECOP Integrado

22 columnas con ~21.8 millones de registros:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nivel_entidad` | text | Nivel: NACIONAL, TERRITORIAL, Corporación Autónoma |
| `codigo_entidad_en_secop` | text | Código en plataforma SECOP |
| `nombre_de_la_entidad` | text | Nombre completo de la entidad |
| `nit_de_la_entidad` | text | NIT de la entidad |
| `departamento_entidad` | text | Departamento |
| `municipio_entidad` | text | Municipio |
| `estado_del_proceso` | text | Celebrado, Liquidado, En ejecución, etc. |
| `modalidad_de_contrataci_n` | text | Contratación Directa, Licitación Pública, etc. |
| `objeto_a_contratar` | text | Descripción detallada del contrato |
| `objeto_del_proceso` | text | Objeto del proceso de contratación |
| `tipo_de_contrato` | text | Prestación de Servicios, Suministro, Obra, etc. |
| `fecha_de_firma_del_contrato` | floating_timestamp | Fecha de firma (ISO 8601) |
| `fecha_inicio_ejecuci_n` | floating_timestamp | Fecha inicio ejecución (ISO 8601) |
| `fecha_fin_ejecuci_n` | floating_timestamp | Fecha fin ejecución (ISO 8601) |
| `numero_del_contrato` | text | ID del contrato |
| `numero_de_proceso` | text | ID del proceso |
| `valor_contrato` | number | Valor en COP |
| `nom_raz_social_contratista` | text | Nombre del contratista |
| `url_contrato` | text | URL al proceso en SECOP |
| `origen` | text | SECOPI o SECOPII |
| `tipo_documento_proveedor` | text | Tipo de documento del proveedor |
| `documento_proveedor` | text | Número de documento del proveedor |

### System fields (cuando `includeSystem: true`)
| Campo | Descripción |
|-------|-------------|
| `:id` | ID interno de la fila |
| `:created_at` | Fecha de creación del registro |
| `:updated_at` | Fecha de última actualización |

---

## 7. Ejemplos prácticos completos

> En todos los ejemplos, reemplazá `TU_TOKEN` por tu app token real.

### 7.1 Contar todos los registros
```bash
curl -X POST "https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json" \
  -H "Content-Type: application/json" \
  -H "X-App-Token: TU_TOKEN" \
  -d '{"query": "SELECT count(*)", "includeSynthetic": false}' | jq
# Resultado: [{"count": "21813064"}]
```

### 7.2 Top 10 entidades con más contratos
```bash
curl -X POST "https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json" \
  -H "Content-Type: application/json" \
  -H "X-App-Token: TU_TOKEN" \
  -d '{
    "query": "SELECT nombre_de_la_entidad, count(*) AS total GROUP BY nombre_de_la_entidad ORDER BY total DESC",
    "page": {"pageNumber": 1, "pageSize": 10},
    "includeSynthetic": false
  }' | jq
```

### 7.3 Contratos de Medellín en 2023 (usando heredoc para evitar escapes)
```bash
curl -X POST "https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json" \
  -H "Content-Type: application/json" \
  -H "X-App-Token: TU_TOKEN" \
  -d @- <<'EOF'
{
  "query": "SELECT * WHERE nombre_de_la_entidad LIKE '%MEDELLIN%' AND date_extract_y(fecha_de_firma_del_contrato) = 2023",
  "page": {"pageNumber": 1, "pageSize": 10}
}
EOF
```

### 7.4 Suma total contratada por departamento
```bash
curl -X POST "https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json" \
  -H "Content-Type: application/json" \
  -H "X-App-Token: TU_TOKEN" \
  -d @- <<'EOF'
{
  "query": "SELECT departamento_entidad, sum(valor_contrato) AS total_valor, count(*) AS cantidad GROUP BY departamento_entidad ORDER BY total_valor DESC",
  "page": {"pageNumber": 1, "pageSize": 15}
}
EOF
```

### 7.5 Contratos más grandes (top 20)
```bash
curl -X POST "https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json" \
  -H "Content-Type: application/json" \
  -H "X-App-Token: TU_TOKEN" \
  -d @- <<'EOF'
{
  "query": "SELECT nombre_de_la_entidad, nom_raz_social_contratista, valor_contrato, departamento_entidad ORDER BY valor_contrato DESC",
  "page": {"pageNumber": 1, "pageSize": 20}
}
EOF
```

### 7.6 Contratos de Prestación de Servicios en Antioquia (> $100M)
```bash
curl -X POST "https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json" \
  -H "Content-Type: application/json" \
  -H "X-App-Token: TU_TOKEN" \
  -d @- <<'EOF'
{
  "query": "SELECT nombre_de_la_entidad, nom_raz_social_contratista, valor_contrato, fecha_de_firma_del_contrato WHERE departamento_entidad = 'Antioquia' AND tipo_de_contrato = 'Prestación de Servicios' AND valor_contrato > 100000000 ORDER BY valor_contrato DESC",
  "page": {"pageNumber": 1, "pageSize": 15}
}
EOF
```

### 7.7 Evolución anual de contratación
```bash
curl -X POST "https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json" \
  -H "Content-Type: application/json" \
  -H "X-App-Token: TU_TOKEN" \
  -d @- <<'EOF'
{
  "query": "SELECT date_extract_y(fecha_de_firma_del_contrato) AS anio, count(*) AS total, sum(valor_contrato) AS monto_total GROUP BY anio ORDER BY anio DESC",
  "page": {"pageNumber": 1, "pageSize": 30}
}
EOF
```

### 7.8 Export CSV de los contratos de un departamento
```bash
curl -X POST "https://www.datos.gov.co/api/v3/views/rpmr-utcd/export.csv" \
  -H "Content-Type: application/json" \
  -H "X-App-Token: TU_TOKEN" \
  -d '{
    "query": "SELECT departamento_entidad, municipio_entidad, valor_contrato, nom_raz_social_contratista WHERE departamento_entidad = '"'"'Antioquia'"'"'",
    "serializationOptions": {"separator": ",", "bom": true}
  }' > antioquia.csv
```

### 7.9 Export CSV completo (con paginación)
```bash
# Export endpoint no usa page — devuelve todo. Para datasets enormes,
# usá el endpoint query con paginación y concatená resultados.
PAGE=1
while true; do
  curl -s -X POST "https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json" \
    -H "Content-Type: application/json" \
    -H "X-App-Token: TU_TOKEN" \
    -d "{\"query\": \"SELECT *\", \"page\": {\"pageNumber\": $PAGE, \"pageSize\": 50000}}" \
    > "pagina_${PAGE}.json"
  COUNT=$(jq length "pagina_${PAGE}.json")
  if [ "$COUNT" -lt 50000 ]; then break; fi
  PAGE=$((PAGE + 1))
done
```

---

## 8. Ejemplos en Python

### 8.1 Con requests (recomendado para SODA 3.0)
```python
import requests
import json

BASE_URL = "https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json"
APP_TOKEN = "TU_TOKEN"

def query_secop(query: str, page_number=1, page_size=1000, **kwargs):
    """Ejecuta una query SoQL contra el endpoint SODA 3.0."""
    payload = {
        "query": query,
        "page": {
            "pageNumber": page_number,
            "pageSize": page_size,
        },
        "includeSynthetic": kwargs.get("includeSynthetic", False),
        "includeSystem": kwargs.get("includeSystem", False),
    }

    headers = {
        "Content-Type": "application/json",
        "X-App-Token": APP_TOKEN,
    }

    resp = requests.post(BASE_URL, json=payload, headers=headers)
    resp.raise_for_status()
    return resp.json()

# Ejemplo 1: Top departamentos por monto
result = query_secop(
    "SELECT departamento_entidad, sum(valor_contrato) AS total_valor, count(*) AS cantidad "
    "GROUP BY departamento_entidad ORDER BY total_valor DESC",
    page_size=10
)
for row in result:
    print(f"{row['departamento_entidad']}: {row['cantidad']} contratos, ${float(row['total_valor']):,.0f} COP")

# Ejemplo 2: Filtrar con parámetros dinámicos
dep = "Antioquia"
anio = 2023
query = f"""
SELECT nombre_de_la_entidad, nom_raz_social_contratista, valor_contrato
WHERE departamento_entidad = '{dep}'
  AND date_extract_y(fecha_de_firma_del_contrato) = {anio}
ORDER BY valor_contrato DESC
"""
result = query_secop(query, page_size=20)
for row in result:
    print(f"  {row['nombre_de_la_entidad']} | {row['nom_raz_social_contratista']} | ${float(row['valor_contrato']):,.0f}")

# Ejemplo 3: Paginar sobre todos los resultados
def paginate_all(query, page_size=50000):
    """Recorre todas las páginas de una query."""
    page = 1
    while True:
        data = query_secop(query, page_number=page, page_size=page_size)
        if not data:
            break
        yield from data
        if len(data) < page_size:
            break
        page += 1
        print(f"  Procesando página {page}...")

all_rows = list(paginate_all("SELECT * WHERE departamento_entidad = 'Bolívar'"))
print(f"Total filas: {len(all_rows)}")
```

### 8.2 Con pandas (análisis directo)
```python
import pandas as pd
import requests

def query_to_df(query, page_size=50000):
    """Ejecuta query y devuelve DataFrame paginando automáticamente."""
    rows = []
    page = 1
    while True:
        resp = requests.post(
            "https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json",
            headers={"Content-Type": "application/json", "X-App-Token": "TU_TOKEN"},
            json={
                "query": query,
                "page": {"pageNumber": page, "pageSize": page_size},
                "includeSynthetic": False,
            }
        )
        resp.raise_for_status()
        data = resp.json()
        if not data:
            break
        rows.extend(data)
        if len(data) < page_size:
            break
        page += 1
    return pd.DataFrame(rows)

# Análisis de contratación por año
df = query_to_df(
    "SELECT date_extract_y(fecha_de_firma_del_contrato) AS anio, "
    "departamento_entidad, count(*) AS total, sum(valor_contrato) AS monto "
    "GROUP BY anio, departamento_entidad "
    "ORDER BY anio DESC, monto DESC"
)
df["monto"] = pd.to_numeric(df["monto"])
df["total"] = pd.to_numeric(df["total"])
print(df.head(20))
```

---

## 9. Ejemplos en JavaScript/Node.js

```javascript
const BASE_URL = "https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json";
const APP_TOKEN = "TU_TOKEN";

async function querySecop(query, { pageNumber = 1, pageSize = 1000, includeSynthetic = false } = {}) {
  const resp = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-App-Token": APP_TOKEN,
    },
    body: JSON.stringify({
      query,
      page: { pageNumber, pageSize },
      includeSynthetic,
    }),
  });
  if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`);
  return resp.json();
}

// Top 10 departamentos por cantidad de contratos
const data = await querySecop(
  "SELECT departamento_entidad, count(*) AS total GROUP BY departamento_entidad ORDER BY total DESC",
  { pageSize: 10 }
);
console.table(data.map(r => ({
  departamento: r.departamento_entidad,
  contratos: Number(r.total).toLocaleString(),
})));
```

---

## 10. Ejemplos en Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

const (
    baseURL   = "https://www.datos.gov.co/api/v3/views/rpmr-utcd/query.json"
    appToken  = "TU_TOKEN"
)

type QueryRequest struct {
    Query            string    `json:"query"`
    Page             Page      `json:"page"`
    IncludeSynthetic bool      `json:"includeSynthetic,omitempty"`
    IncludeSystem    bool      `json:"includeSystem,omitempty"`
}

type Page struct {
    PageNumber int `json:"pageNumber"`
    PageSize   int `json:"pageSize"`
}

func querySecop(query string, pageNum, pageSize int) ([]map[string]interface{}, error) {
    payload := QueryRequest{
        Query: query,
        Page:  Page{PageNumber: pageNum, PageSize: pageSize},
    }

    body, _ := json.Marshal(payload)
    req, _ := http.NewRequest("POST", baseURL, bytes.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("X-App-Token", appToken)

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var results []map[string]interface{}
    if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
        return nil, err
    }
    return results, nil
}

func main() {
    results, _ := querySecop(
        "SELECT departamento_entidad, count(*) AS total GROUP BY departamento_entidad ORDER BY total DESC",
        1, 10,
    )
    for _, r := range results {
        fmt.Printf("%s: %s contratos\n", r["departamento_entidad"], r["total"])
    }
}
```

---

## 11. SDKs y librerías (compatibles con SODA 3.0)

Verificar compatibilidad con SODA 3.0 antes de usar. La mayoría fueron escritos para 2.x.

| Lenguaje | Librería | URL |
|----------|----------|-----|
| Python | sodapy | https://github.com/xmunoz/sodapy |
| R | RSocrata | https://github.com/Chicago/RSocrata |
| JavaScript | soda-js | https://github.com/socrata/soda-js |
| Ruby | soda-ruby | https://github.com/socrata/soda-ruby |
| Java | soda-java | https://github.com/socrata/soda-java |
| Go | go-soda | https://github.com/SebastiaanKlippert/go-soda |
| PHP | soda-php | https://github.com/socrata/soda-php |
| .NET | SODA.NET | https://github.com/CityofSantaMonica/SODA.NET |
| Julia | Socrata.jl | https://github.com/drewgendreau/Socrata.jl |
| Elixir | exsoda | https://github.com/rozap/exsoda |

Para SODA 3.0 el enfoque más simple es usar HTTP POST directo con `requests`/`fetch`/`net/http`, ya que la API es trivial.

---

## 12. Notas importantes

### App Token obligatorio
En SODA 3.0 **no hay requests anónimos**. Sin app token o autenticación, la API devuelve `authentication_required`.

### Content-Type
Siempre usar `Content-Type: application/json`. Las queries van en el body como JSON, no como form-encoded.

### Comillas en JSON
El mayor dolor de cabeza: strings SoQL usan comillas simples (`'`), y JSON también. Estrategias:
- **Heredoc en bash:** `-d @- <<'EOF' ... EOF` (evita todo escape)
- **Python/JS/Go:** Usar f-strings o template literals, la librería HTTP lo serializa
- **Archivo:** `curl ... -d @query.json`

### Límites
- **pageSize máximo:** 50,000 filas por página
- **Timeout:** 600 segundos (10 minutos) por request
- **Throttling:** Con app token, el límite es por aplicación (no por IP)

### SoQL: Sin FROM
En SoQL no se usa `FROM` porque la query siempre opera sobre un único dataset (el del endpoint).

### Buenas prácticas
1. **Filtrá con WHERE** — no traigas todo y filtres en cliente.
2. **SELECT específico** — pedí solo las columnas que necesitás.
3. **`orderingSpecifier: "discard"`** — si no necesitás orden, ahorra recursos.
4. **Paginar con cuidado** — páginas altas degradan performance. Preferí filtrar.
5. **Usá `/export` para descargas masivas** — es más eficiente que `/query` para CSV.

---

## 13. Referencias

- [Portal Dev Socrata](https://dev.socrata.com)
- [SoQL Queries (SODA 3.0)](https://dev.socrata.com/docs/queries/)
- [SoQL Functions](https://dev.socrata.com/docs/functions/)
- [API Endpoints](https://dev.socrata.com/docs/endpoints.html)
- [App Tokens](https://dev.socrata.com/docs/app-tokens.html)
- [Data Formats](https://dev.socrata.com/docs/formats/)
- [Response Codes & Headers](https://dev.socrata.com/docs/response-codes)
- [Dataset SECOP Integrado](https://www.datos.gov.co/Estad-sticas-Nacionales/SECOP-Integrado/rpmr-utcd)
- [Documentación API del dataset](https://dev.socrata.com/foundry/www.datos.gov.co/rpmr-utcd)

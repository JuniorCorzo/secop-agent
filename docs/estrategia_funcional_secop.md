# Propuesta de Estrategia Funcional y de Datos: Filtros Duros y Scoring de Convocatorias en SECOP I y SECOP II

El desarrollo de un sistema avanzado de emparejamiento entre las convocatorias del Estado colombiano y los perfiles de empresas licitadoras requiere una sólida estrategia de arquitectura de datos y un modelo analítico riguroso. Este informe técnico expone la especificación funcional y el diseño conceptual para la Fase 1 del Sprint 3, integrando las fuentes oficiales de SECOP I (ID de dataset: `f789-7hwg`) y SECOP II (ID de dataset: `p6dx-8zbt`) administradas por la Agencia Nacional de Contratación Pública - Colombia Compra Eficiente. La arquitectura propuesta optimiza la ingesta de datos a través de la API SODA de Socrata, unificando la lógica de negocio para los filtros duros de exclusión y la formulación matemática de un scoring de afinidad multidimensional.

---

## 1. Mapeo de Filtros Duros de Exclusión (ANC-74)

Los filtros duros constituyen el primer nivel de descarte en el pipeline de procesamiento de datos. Su función principal es excluir de forma definitiva cualquier convocatoria que la empresa licitadora no pueda o no deba ejecutar por restricciones financieras, operativas, geográficas, legales o de tiempo.

### Capacidad Financiera y Validación de Capacidad Residual (K de Contratación)

La validación financiera tradicional compara el presupuesto de la licitación con el cupo de endeudamiento o la capacidad financiera del licitador. En Colombia, para procesos clasificados como contratos de obra pública, la legislación (Ley 1150 de 2007 y Decreto Ley 019 de 2012) exige verificar de manera estricta la Capacidad Residual de Contratación, también denominada $K$ de Contratación, para garantizar que el oferente cuente con la holgura operativa suficiente.

Para contratos generales de servicios o suministros, el sistema evalúa que el presupuesto estimado del proceso, extraído de `cuantia_proceso` en SECOP I o de `precio_base` en SECOP II, sea menor o igual a la capacidad financiera máxima registrada en el perfil del licitador.

Para contratos de obra pública, identificados mediante el valor "Obra" en el campo `tipo_de_contrato`, el sistema calcula dinámicamente la Capacidad Residual ($K_R$) exigida para el proceso y la contrasta con el saldo de contratos en ejecución ($SCE$) del licitador. La fórmula para determinar la Capacidad Residual del proponente se expresa mediante la siguiente relación matemática:

$$K_R = FCC_n - SCE_n$$

Donde:
* $FCC_n$ es el Flujo de Caja de Contratación para el período evaluado, derivado de la Capacidad de Organización ($CO$) del licitador. Para oferentes con cinco o más años de información financiera, la $CO$ equivale al mayor ingreso operacional de los últimos cinco años. Para empresas con una trayectoria de uno a cinco años, corresponde al mayor ingreso operacional de sus años de existencia, y para empresas con menos de un año, se tasa en USD 125.000 liquidados según el umbral Mipyme.
* $SCE_n$ es el Saldo de Contratos en Ejecución del proponente para el período, calculado de forma lineal diaria o mensual para prorratear el valor pendiente por ejecutar:

$$SCE_n = \sum_{i=1}^{M} \left( \frac{\text{Valor del Contrato}_i}{\text{Plazo del Contrato}_i \text{ (días)}} \times \text{Días Pendientes}_i \right)$$

Adicionalmente, si el proponente cuenta con menos de dos años de información financiera, el flujo de caja se calcula en base al capital de trabajo neto ($WK$), el cual se obtiene de los estados financieros presentados en el Registro Único de Proponentes (RUP):

$$WK = \text{Activo Corriente} - \text{Pasivo Corriente}$$

La oportunidad se excluye de forma automática si la Capacidad Residual exigida por la entidad contratante supera la capacidad neta calculada para el licitador en el período de ejecución estimado.

### Sector de Interés (Clasificador UNSPSC)

El cruce sectorial se realiza mediante el Clasificador de Bienes y Servicios de las Naciones Unidas (UNSPSC), estandarizado por Colombia Compra Eficiente para la planificación contractual de las entidades estatales. Este clasificador jerárquico se compone de cuatro niveles:

$$\text{Segmento (Nivel 1)} \rightarrow \text{Familia (Nivel 2)} \rightarrow \text{Clase (Nivel 3)} \rightarrow \text{Producto (Nivel 4)}$$

El filtro duro de sector opera mediante una comprobación de herencia jerárquica. El sistema extrae el código del proceso desde el campo `id_objeto_a_contratar` en SECOP I o de las propiedades de categorización en SECOP II, y verifica si pertenece al conjunto de códigos UNSPSC habilitados en el RUP de la empresa licitadora. Si se configura una política de descarte estricto, se requiere coincidencia al nivel de Clase (primeros seis dígitos); si la política es flexible, se admite coincidencia al nivel de Familia (primeros cuatro dígitos). Si no existe coincidencia dentro de la jerarquía mínima exigida, la convocatoria se descarta.

### Cobertura Geográfica

El filtro geográfico valida la viabilidad logística de la empresa frente a la ubicación del contrato. En SECOP I, la ubicación geográfica se almacena en el campo de texto libre `municipios_ejecucion`, mientras que en SECOP II se registra en las variables estructuradas `departamento_entidad` y `ciudad_entidad`. El sistema de datos traduce estas variables de texto a códigos DIVIPOLA nacionales administrados por el DANE para realizar una intersección exacta de conjuntos entre la cobertura del licitador y la localización de la oportunidad. Cualquier proceso cuya ubicación no se cruce con las regiones de cobertura habilitadas de la empresa es rechazado.

### Exclusiones por Tipo de Contrato y Modalidad de Contratación

Ciertas modalidades de contratación representan un riesgo financiero u operativo inviable para algunas empresas. Por ejemplo, modalidades como la Contratación Directa o tipos de contrato de régimen especial suelen ser omitidos en las estrategias comerciales de licitadores competitivos. El filtro analiza las variables `tipo_de_contrato` y `modalidad_de_contratacion` en ambas plataformas. Si el tipo o la modalidad coinciden con la lista negra de exclusiones parametrizada por el licitador, el proceso es descartado.

### Fecha Límite de Recepción de Propuestas

Este filtro temporal evalúa la vigencia de la oportunidad. En SECOP II se examina la variable `fecha_de_recepcion_de` (Fecha de Recepción de Respuestas), la cual contiene la marca de tiempo límite para la postulación. El sistema descarta inmediatamente cualquier registro donde la hora actual del servidor supere esta fecha límite. 

Debido a que el conjunto de datos de SECOP I (`f789-7hwg`) contiene principalmente registros de contratos ya adjudicados y firmados cargados con posterioridad a su ejecución, la validación temporal de plazos de postulación activos se concentra casi en su totalidad en los datos transaccionales en tiempo real de SECOP II (`p6dx-8zbt`). SECOP I opera bajo esta arquitectura principalmente como un repositorio para el análisis de precios, competidores y experiencia histórica de contratación.

---

### Inconsistencias de Datos Críticas y Mitigación Conceptual

El análisis de calidad sobre las bases de datos de contratación pública de Colombia devela inconsistencias que el pipeline de datos debe resolver antes de ejecutar los filtros de exclusión.

| Categoría de Inconsistencia | Plataforma Afectada | Descripción del Impacto Técnico | Estrategia Conceptual de Mitigación en el Pipeline |
| :--- | :--- | :--- | :--- |
| **Discrepancia en Entidades Geográficas** | SECOP I (`f789-7hwg`) y SECOP II (`p6dx-8zbt`) | Variaciones ortográficas, omisión de tildes o uso de cadenas compuestas (ej. "BOGOTA", "Bogotá D.C.", "Distrito Capital de Bogotá"). | Implementar una etapa de normalización geográfica que asocie cada cadena de texto a un código oficial DIVIPOLA del DANE. El cruce de exclusión geográfica se ejecuta sobre los códigos numéricos normalizados. |
| **Representación de Valores Monetarios** | SECOP I (`f789-7hwg`) y SECOP II (`p6dx-8zbt`) | Presupuestos registrados como cadenas de texto con símbolos especiales o valores de cuantía en cero o "No Definido". | Aplicar expresiones regulares en la fase de extracción para eliminar caracteres no numéricos y forzar el tipo de dato `Decimal`. Si el presupuesto resulta nulo o inconsistente, la convocatoria se asigna a una cola de revisión manual en lugar de ser descartada en silencio. |
| **Formatos de Fecha Heterogéneos** | SECOP I (`f789-7hwg`) y SECOP II (`p6dx-8zbt`) | Diferencias de zona horaria entre el formato local (GMT-5) y marcas de tiempo UTC, además de valores nulos en plazos de fases iniciales. | Diseñar un parser robusto con soporte multipatrón que unifique todas las fechas al estándar ISO-8601 con zona horaria explícita (`YYYY-MM-DDThh:mm:ss-05:00`). Las fechas ilegibles en procesos vigentes provocan el rechazo automático del registro por riesgo de cumplimiento. |
| **Falta de Codificación UNSPSC Estructurada** | SECOP I (`f789-7hwg`) | Registro del clasificador de bienes en formato de texto libre no estructurado o con códigos desactualizados bajo versiones previas de la guía. | Utilizar un diccionario de homologación de códigos UNSPSC provisto por Colombia Compra Eficiente. En caso de ausencia del código digital, un clasificador NLP entrenado con la taxonomía UNSPSC asocia la descripción del campo `objeto_a_contratar` con el código de clase correspondiente. |

---

## 2. Documento de Especificación Funcional

La tabla de especificación funcional establece la correspondencia directa y la lógica de negocio requerida para cruzar la información de las APIs de datos abiertos con las propiedades del perfil del licitador.

| Requisito de Negocio | Tipo de Dato | Propiedad en SECOP I (`f789-7hwg`) | Propiedad en SECOP II (`p6dx-8zbt`) | Atributo del Perfil del Licitador | Lógica de Comparación y Reglas de Negocio |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Aptitud de Presupuesto** | Decimal | `cuantia_proceso` | `precio_base` | `capacidad_financiera_maxima` | Valida que el presupuesto estimado no supere la capacidad financiera del licitador. Regla: $\text{Valor API} \le \text{capacidad\_financiera\_maxima}$. |
| **Capacidad Residual (Obra)** | Decimal / Fórmula | `tipo_de_contrato` y `cuantia_proceso` | `tipo_de_contrato` y `precio_base` | `capacidad_residual_kr`, `saldo_contratos_ejecucion` | Si el tipo de contrato es "Obra", calcula la capacidad residual requerida y la compara con la disponible del licitador. Regla: $K_{\text{R\_requerida}} \le K_{\text{R\_disponible}}$. |
| **Filtro Sectorial** | Alfanumérico / Array | `id_objeto_a_contratar` (jerarquizado en `id_grupo`, `id_familia`, `id_clase`) | Códigos de categorización de la oportunidad | `codigos_unspsc_autorizados` (extraídos del RUP) | Valida la coincidencia del código del proceso dentro del listado de códigos autorizados del RUP, según la profundidad jerárquica configurada. |
| **Filtro Geográfico** | Alfanumérico / Array | `municipios_ejecucion` | `departamento_entidad` | `regiones_cobertura` (códigos DIVIPOLA) | Traduce las ubicaciones a códigos DIVIPOLA y realiza una intersección. Regla: $\text{DIVIPOLA(Proceso)} \cap \text{regiones\_cobertura} \neq \emptyset$. |
| **Filtro de Modalidad** | Alfanumérico | `modalidad_de_contratacion` | `modalidad_de_contratacion` | `exclusiones_modalidad` | Verifica que la modalidad de selección del proceso no esté excluida por el licitador. Regla: $\text{Valor API} \notin \text{exclusiones\_modalidad}$. |
| **Filtro de Tipo Contrato** | Alfanumérico | `tipo_de_contrato` | `tipo_de_contrato` | `exclusiones_tipo_contrato` | Verifica que el tipo de contrato no esté excluido por el licitador. Regla: $\text{Valor API} \notin \text{exclusiones\_tipo\_contrato}$. |
| **Control de Vigencia** | DateTime | `fecha_de_cargue_en_el_secop` (uso histórico) | `fecha_de_recepcion_de` | No Aplica | Descarta los procesos cuya fecha límite haya expirado frente a la fecha actual del servidor ($T_C$). Regla: $T_C \le \text{fecha\_de\_recepcion\_de}$. |

---

## 3. Modelo de Cálculo de Puntuaciones (ANC-75)

Aquellos procesos de contratación que logran superar el bloque de filtros duros de exclusión avanzan al motor de scoring multidimensional. Este modelo computa un puntaje final sobre un rango de 0 a 100 puntos, distribuidos en cuatro vectores de afinidad de negocio.

| Vector de Scoring | Subcomponente Analítico | Peso en Puntos | Descripción Operativa de la Métrica |
| :--- | :--- | :--- | :--- |
| **Technical Fit (0-40 pts)** | Match Jerárquico UNSPSC | 20 puntos | Pondera la cercanía en el clasificador de bienes y servicios. |
| | Similitud Semántica de Objeto | 20 puntos | TF-IDF / BM25 y similitud de coseno sobre descripciones libres. |
| **Economic Fit (0-25 pts)** | Desviación de Ticket Objetivo | 15 puntos | Mide la concordancia del presupuesto frente al tamaño de negocio buscado. |
| | Capacidad de Flujo de Caja | 10 puntos | Compara los costos de ejecución mensual estimados con el capital de trabajo. |
| **Experience Match (0-20 pts)** | Similitud de Contratos Previos | 10 puntos | Vectorización semántica de contratos pasados de la empresa frente al proceso. |
| | Densidad de Experiencia Sectorial | 10 puntos | Cantidad de contratos ejecutados históricamente en la misma clase UNSPSC. |
| **Affinity Match (0-15 pts)** | Historial con Entidad Estatal | 10 puntos | Coincidencia de NIT con entidades donde ya se han ejecutado contratos. |
| | Historial Regional Geográfico | 5 puntos | Experiencia del licitador en el mismo departamento de ejecución. |

### Technical Fit (0-40 puntos)

Este vector mide la correspondencia técnica y de especialidad operativa entre el licitador y el requerimiento del Estado.

#### Match Jerárquico UNSPSC (Máximo 20 puntos)

El sistema evalúa el nivel de coincidencia en el árbol de clasificación de Naciones Unidas entre el código requerido por la convocatoria y los códigos autorizados del licitador:
* **Coincidencia al nivel de Clase o Producto (Dígitos 1-6 o 1-8)**: **20 puntos**. Representa una especialización técnica óptima del licitador en la materia del contrato.
* **Coincidencia al nivel de Familia (Dígitos 1-4)**: **15 puntos**. Indica que la empresa opera en la misma línea general de negocio, aunque no sea su especialidad principal.
* **Coincidencia al nivel de Segmento (Dígitos 1-2)**: **10 puntos**. Indica que el licitador pertenece al mismo macro-sector industrial.
* **Ausencia de correspondencia jerárquica**: **0 puntos**.

#### Similitud Semántica y Coincidencia de Palabras Clave (Máximo 20 puntos)

Se procesa el campo textual de descripción del proceso, correspondiente a `detalle_del_objeto_a_contratar` en SECOP I o a `descripci_n_del_procedimiento` en SECOP II. El pipeline de procesamiento remueve palabras vacías (*stop-words*), tokeniza y lematiza los términos. Posteriormente, se genera una representación vectorial del texto empleando TF-IDF o el algoritmo BM25. 

La similitud entre la descripción de la oportunidad ($D_{\text{oportunidad}}$) y la matriz de capacidades y portafolio textual de la empresa ($V_{\text{empresa}}$) se calcula mediante la similitud de coseno:

$$\text{Similitud}_{\text{Coseno}}(D_{\text{oportunidad}}, V_{\text{empresa}}) = \frac{\vec{D}_{\text{oportunidad}} \cdot \vec{V}_{\text{empresa}}}{\|\vec{D}_{\text{oportunidad}}\| \|\vec{V}_{\text{empresa}}\|}$$

$$\text{Puntaje}_{\text{Keyword}} = 20 \times \text{Similitud}_{\text{Coseno}}(D_{\text{oportunidad}}, V_{\text{empresa}})$$

---

### Economic Fit (0-25 puntos)

Garantiza la viabilidad económica del proyecto para el licitador, analizando los ingresos proyectados y la solvencia de caja requerida.

#### Margen Esperado vs. Presupuesto Estimado (Máximo 15 puntos)

Se evalúa la concordancia entre el presupuesto total de la oportunidad ($C_B$), obtenido de `precio_base` o `cuantia_proceso`, y el ticket objetivo o presupuesto ideal de contrato definido por la empresa ($B_{\text{target}}$). El desvío relativo se calcula mediante la siguiente función:

$$D_{\text{margen}} = \frac{|C_B - B_{\text{target}}|}{B_{\text{target}}}$$

La asignación de puntos penaliza las desviaciones excesivas respecto al tamaño de negocio óptimo de la empresa:
* Si $D_{\text{margen}} \le 0.15$ (el presupuesto se encuentra dentro del rango de aceptación del $\pm 15\%$): **15 puntos**.
* Si $0.15 < D_{\text{margen}} \le 0.50$: Se aplica una curva de decaimiento exponencial para mitigar de forma suave la pérdida de afinidad económica:

$$\text{Puntaje}_{\text{Margen}} = 15 \times e^{-3 \cdot (D_{\text{margen}} - 0.15)}$$

* Si $D_{\text{margen}} > 0.50$ (el proyecto es demasiado pequeño o excesivamente grande para la capacidad económica del licitador): **0 puntos**.

#### Tasa Valor/Plazo y Flujo de Caja Mensual (Máximo 10 puntos)

Evalúa si la liquidez operativa de la empresa le permite financiar los costos de ejecución del proyecto ante los plazos de facturación y pago estatales. Se calcula la demanda de flujo de caja mensual estimada ($CF_{\text{proceso}}$) dividiendo el presupuesto entre el plazo de ejecución del contrato normalizado a meses, el cual se deriva de `duracion` y `unidad_de_duracion` en SECOP II:

$$CF_{\text{proceso}} = \frac{\text{Presupuesto Total}}{\text{Plazo de Ejecución (Meses)}}$$

Esta demanda se evalúa frente al capital de trabajo neto disponible del licitador ($WK = \text{Activo Corriente} - \text{Pasivo Corriente}$), el cual representa los recursos financieros líquidos de la empresa:

$$\text{Puntaje}_{\text{Flujo}} = 
\begin{cases} 
10 & \text{si } WK \ge 3 \times CF_{\text{proceso}} \\
5 & \text{si } 1.5 \times CF_{\text{proceso}} \le WK < 3 \times CF_{\text{proceso}} \\
0 & \text{si } WK < 1.5 \times CF_{\text{proceso}}
\end{cases}$$

---

### Experience Match (0-20 puntos)

Este bloque evalúa la idoneidad y el respaldo empírico de la trayectoria del oferente en contratos equivalentes.

#### Similitud Semántica de Contratos Anteriores (Máximo 10 puntos)

El sistema procesa la descripción de los contratos previos ejecutados por la empresa, almacenados en su histórico del RUP o base de datos de clientes, frente al objeto de la licitación actual. Empleando modelos de representación de lenguaje profundo (SBERT), se generan vectores embebidos densos para calcular la similitud semántica. La puntuación se asigna en función de la máxima concordancia registrada con alguno de los contratos históricos de la empresa:

$$\text{Puntaje}_{\text{Semántica}} = 10 \times \max_{i} \left( \text{Similitud}_{\text{Semántica}}(O_{\text{oportunidad}}, H_{\text{historico\_}i}) \right)$$

#### Densidad y Frecuencia de Experiencia Previa (Máximo 10 puntos)

Mide de forma cuantitativa el respaldo de la empresa en la clase UNSPSC requerida por el proceso. Se realiza un conteo de los contratos históricos de la empresa que presenten coincidencia exacta a nivel de Clase UNSPSC (primeros seis dígitos) con la licitación bajo análisis:

$$\text{Puntaje}_{\text{Densidad}} = \min\left(10, \text{Cantidad de Contratos en la Clase} \times 2 \right)$$

---

### Affinity & Geographical Match (0-15 puntos)

Mide las ventajas competitivas de la empresa derivadas de su relación previa con la entidad y su presencia territorial.

#### Afinidad con la Entidad Contratante (Máximo 10 puntos)

Haber ejecutado contratos con éxito previamente para la misma entidad estatal representa un factor de afinidad sustancial debido al conocimiento de sus requerimientos técnicos específicos. La verificación de la experiencia directa se realiza comparando el NIT de la entidad con el NIT del cliente de los contratos liquidados en el histórico de la empresa.
* **Identificador en SECOP II**: `nit_entidad`.
* **Identificador en SECOP I**: `nit_de_la_entidad`.
* **Asignación de Puntos**: Si se registra al menos un contrato ejecutado y liquidado con coincidencia exacta de NIT, se asignan **10 puntos**. Si no hay relación previa con la entidad contratante, se asignan **0 puntos**.

#### Presencia Geográfica e Histórica Regional (Máximo 5 puntos)

Evalúa la experiencia previa del oferente en la misma demarcación geográfica del contrato para asegurar capacidad de movilización logística regional.
* **Criterio de Evaluación**: Se contrasta el código de departamento de la oportunidad con la lista de departamentos donde el licitador tiene oficinas registradas o ha ejecutado y liquidado previamente al menos tres contratos de obra o servicios.
* **Puntuación**: Si se confirma la presencia territorial o experiencia regional consolidada, se otorgan **5 puntos**. Si no se registra actividad previa en la zona, se asignan **0 puntos**.

---

## 4. Estructura Lógica de la Bitácora de Resultados (Audit Log)

La transparencia de las decisiones de asignación y descarte es crucial para generar confianza en el sistema. Para ello, el motor de emparejamiento debe persistir una bitácora detallada de resultados (*Matching Result Log*). Este registro almacena de forma estructurada e histórica la justificación técnica que causó la exclusión de una licitación o el desglose preciso de su puntuación final.

### Esquema Conceptual JSON de la Bitácora

```json
{
  "$schema": "[https://json-schema.org/draft/2020-12/schema](https://json-schema.org/draft/2020-12/schema)",
  "title": "MatchingResultLog",
  "type": "object",
  "properties": {
    "matching_id": { "type": "string" },
    "licitador": {
      "type": "object",
      "properties": {
        "nit_empresa": { "type": "string" },
        "razon_social": { "type": "string" }
      },
      "required": ["nit_empresa", "razon_social"]
    },
    "convocatoria": {
      "type": "object",
      "properties": {
        "id_sistema": { "type": "string" },
        "referencia_proceso": { "type": "string" },
        "fuente_dataset": { "type": "string" },
        "entidad_compradora": { "type": "string" },
        "nit_entidad": { "type": "string" },
        "departamento_ejecucion": { "type": "string" }
      },
      "required": ["id_sistema", "fuente_dataset", "nit_entidad"]
    },
    "metadata_ejecucion": {
      "type": "object",
      "properties": {
        "timestamp_evaluacion": { "type": "string", "format": "date-time" },
        "version_algoritmo": { "type": "string" }
      },
      "required": ["timestamp_evaluacion", "version_algoritmo"]
    },
    "fase_filtros_duros": {
      "type": "object",
      "properties": {
        "resultado_general": { "type": "string", "enum": ["APPROVED", "EXCLUDED"] },
        "causa_exclusion": { "type": "string" },
        "detalle_evaluacion": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "filtro": { "type": "string" },
              "regla_aplicada": { "type": "string" },
              "valor_proceso": { "type": "string" },
              "valor_licitador": { "type": "string" },
              "estado": { "type": "string", "enum": ["PASSED", "FAILED"] }
            },
            "required": ["filtro", "regla_aplicada", "estado"]
          }
        }
      },
      "required": ["resultado_general", "detalle_evaluacion"]
    },
    "fase_scoring": {
      "type": "object",
      "properties": {
        "puntuacion_final": { "type": "number", "minimum": 0, "maximum": 100 },
        "desglose_vectores": {
          "type": "object",
          "properties": {
            "technical_fit": {
              "type": "object",
              "properties": {
                "puntos_obtenidos": { "type": "number" },
                "puntos_maximos": { "type": "number" },
                "metricas": { "type": "object" }
              },
              "required": ["puntos_obtenidos", "puntos_maximos"]
            },
            "economic_fit": {
              "type": "object",
              "properties": {
                "puntos_obtenidos": { "type": "number" },
                "puntos_maximos": { "type": "number" },
                "metricas": { "type": "object" }
              },
              "required": ["puntos_obtenidos", "puntos_maximos"]
            },
            "experience_match": {
              "type": "object",
              "properties": {
                "puntos_obtenidos": { "type": "number" },
                "puntos_maximos": { "type": "number" },
                "metricas": { "type": "object" }
              },
              "required": ["puntos_obtenidos", "puntos_maximos"]
            },
            "affinity_geographical_match": {
              "type": "object",
              "properties": {
                "puntos_obtenidos": { "type": "number" },
                "puntos_maximos": { "type": "number" },
                "metricas": { "type": "object" }
              },
              "required": ["puntos_obtenidos", "puntos_maximos"]
            }
          },
          "required": ["technical_fit", "economic_fit", "experience_match", "affinity_geographical_match"]
        }
      }
    },
    "justificacion_narrativa": { "type": "string" }
  },
  "required": ["matching_id", "licitador", "convocatoria", "metadata_ejecucion", "fase_filtros_duros"]
}
```

### Funcionalidad de la Justificación Narrativa

La bitácora incorpora un componente traductor de datos diseñado para redactar explicaciones comprensibles en lenguaje natural. Este componente recopila los valores del log estructurado de emparejamiento para armar la justificación descriptiva:
* **Justificación en Escenario de Exclusión**: Cuando el resultado general del bloque de filtros duros es "EXCLUDED", el componente identifica el primer filtro con estado "FAILED" y construye un texto detallando la restricción (ej. *"La convocatoria fue excluida debido a que su ubicación geográfica en el departamento de Nariño no coincide con las zonas de cobertura del perfil de la empresa"*).
* **Justificación en Escenario de Aprobación**: Si el proceso avanza al cálculo de puntuación, el componente redacta un resumen destacando las fortalezas del emparejamiento y alertando sobre posibles desviaciones (ej. *"La convocatoria presenta un elevado Technical Fit de 35.00/40.00 puntos gracias a la coincidencia directa en la clase UNSPSC 43211500 (Computadores de escritorio) y una similitud del 75% en la descripción del objeto. No obstante, se advierte un riesgo moderado en el Economic Fit debido a que el capital de trabajo de la empresa se encuentra cerca del límite mínimo requerido para financiar la tasa de flujo mensual estimada"*).

---

## 5. Conclusiones y Recomendaciones Arquitecturales

El diseño funcional planteado sienta las bases para el despliegue técnico del motor de emparejamiento de convocatorias. Para garantizar su escalabilidad operativa, se establecen las siguientes recomendaciones de arquitectura:

* **Procesamiento Asíncrono de Ingesta**: Dado el volumen masivo de los datasets de SECOP (con más de 8.6 millones de filas en SECOP II y actualizaciones de frecuencia diaria), es indispensable implementar un pipeline de ingesta asíncrono. Los filtros duros de exclusión geográficos y de tipo de contrato deben ejecutarse en la base de datos relacional intermedia utilizando consultas indexadas, limitando el consumo de recursos de cómputo avanzado de similitud semántica únicamente a aquellos registros que superan el bloque de descarte inicial.
* **Indexación Geográfica por DIVIPOLA**: La mitigación de las variaciones ortográficas en los nombres de departamentos y municipios debe abordarse mediante la unificación de los identificadores geográficos de SECOP I y SECOP II bajo los códigos oficiales DIVIPOLA. Este mapeo debe ocurrir en la etapa de preprocesamiento de la ingesta para que todas las comparaciones geográficas se realicen sobre índices numéricos de base de datos de alta velocidad.
* **Caché Semántica de Perfiles e Históricos**: La vectorización de los contratos previos ejecutados por los licitadores para el cálculo de similitud semántica debe precalculase y almacenarse en una base de datos vectorial dedicada. Al momento de evaluar una nueva convocatoria del SECOP, solo se computará el embedding del texto entrante para realizar una búsqueda rápida de vecinos más cercanos frente a los perfiles ya indexados, reduciendo sustancialmente los costos de procesamiento del servidor.
* **Monitoreo Sistemático del Pipeline**: Las variaciones inesperadas en la disponibilidad de los endpoints públicos de la API SODA exigen implementar un panel administrativo de auditoría de sincronizaciones. Este panel debe monitorear el rendimiento de los cron-jobs, registrando la última actualización exitosa, la duración del proceso, la cantidad de registros importados y los errores de esquema detectados para garantizar la estabilidad del servicio de alertas y emparejamiento de convocatorias.
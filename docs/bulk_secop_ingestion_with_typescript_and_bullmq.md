# **Arquitectura para la Ingesta Masiva y Unificación de SECOP I y SECOP II: Procesamiento de Alto Rendimiento mediante TypeScript, BullMQ y SODA API en Bun**

## **Análisis de Origen: Ecosistema SECOP y Restricciones de la SODA API**

La ingesta y consolidación analítica de la contratación pública en Colombia requiere la sincronización de múltiples fuentes alojadas en la plataforma de datos abiertos del Estado. Estas fuentes abarcan desde el registro histórico estático de SECOP I hasta el ecosistema transaccional y multifacético de SECOP II. La escala combinada de estos conjuntos de datos supera los 15 millones de registros, distribuidos en diversas tablas que reflejan las necesidades de contratación, los contratos perfeccionados, las modificaciones presupuestales y el registro de proveedores.  
El acceso programático a estos datos se realiza mediante la interfaz Socrata Open Data API (SODA).4 Aunque la plataforma datos.gov.co permite la ejecución de consultas sin credenciales, el tráfico no autenticado está sujeto a límites de cuota estrictos que derivan en respuestas de error de tipo límite de velocidad superado (HTTP Status 429).6 Para operar a escala industrial, es indispensable incorporar un token de aplicación (App Token) en las cabeceras de las peticiones.6 El uso del App Token incrementa sustancialmente el límite de transacciones permitidas, aunque la infraestructura compartida de Socrata conserva mecanismos de protección que penalizan las ráfagas excesivas o los patrones de consulta ineficientes.6  
Un factor de diseño crítico es la diferencia entre las versiones de la API de SODA en lo relativo al volumen máximo de registros devueltos por petición. Los endpoints que operan bajo SODA v2.0 imponen un límite rígido parametrizado de máximo 50,000 registros por consulta. En contraste, las versiones SODA v2.1 y v3.0 eliminan teóricamente el límite máximo superior, aunque mantienen un valor predeterminado de 1,000 registros si el parámetro $limit no es definido explícitamente por el consumidor. La siguiente tabla detalla la estructura y los desafíos operacionales asociados a cada uno de los conjuntos de datos del ecosistema SECOP:

| Conjunto de Datos | Identificador SODA | Tipo de Datos / Granularidad | Desafíos de Consumo y Consistencia |
| :---- | :---- | :---- | :---- |
| **SECOP I \- Procesos de Compra Pública Histórico** | N/D | Informativo / Histórico Plano | Estructuras de texto inconsistentes, ausencia de claves primarias normalizadas, ingreso manual de datos sin validación. |
| **SECOP II \- Procesos de Contratación** | p6dx-8zbt | Transaccional / Nivel de Proceso | Presencia de un 3.9% de duplicados sobre el identificador único del proceso que exige conciliación lógica.8 |
| **SECOP II \- Contratos Electrónicos** | N/D | Transaccional / Nivel de Contrato | Representa la granularidad más fina de las transacciones; requiere vinculación estructural con la tabla de procesos. |
| **SECOP II \- Adiciones** | N/D | Historial de Modificaciones | Registra prórrogas de tiempo y sobrecostos presupuestales que deben agruparse por contrato.8 |
| **SECOP II \- Proveedores Registrados** | N/D | Directorio de Terceros | Contiene datos sobre la tipología de las firmas y fechas de registro, plagado de registros duplicados e identificadores inconsistentes.8 |

## **Ingeniería de Flujos de Datos: Streaming de JSON, Contrapresión y Decodificación Resiliente**

La recuperación de millones de filas mediante paginación clásica basada en los operadores $limit y $offset presenta un problema de degradación de rendimiento a gran escala. En una paginación convencional, para extraer un rango avanzado de datos, la base de datos de Socrata debe realizar un escaneo interno, ordenar y descartar de forma secuencial todos los registros precedentes.9 A medida que el desplazamiento se adentra en la escala de los millones de registros, el tiempo de respuesta de la API aumenta linealmente hasta provocar fallos por tiempo de espera agotado (Gateway Timeout).  
Para neutralizar este cuello de botella, la arquitectura debe migrar hacia un esquema de paginación basado en claves o cursor dinámico.13 Mediante este enfoque, las peticiones ordenan de manera estricta los registros por un campo secuencial indexado (como la fecha de publicación o el identificador único del proceso) mediante el parámetro $order.11 Posteriormente, cada consulta sucesiva utiliza una cláusula $where para filtrar únicamente los registros cuyo valor de orden sea estrictamente superior al último registro procesado en el lote anterior.13 Este procedimiento reduce la complejidad temporal del escaneo en el motor de base de datos origen:  
![][image1]  
![][image2]  
Paralelamente, la persistencia en el hilo consumidor se beneficia sustancialmente al ejecutarse bajo Bun. A diferencia de otros entornos, Bun utiliza el motor de alto rendimiento JavaScriptCore (JSC) de Apple y el asignador de memoria de bajas latencias mimalloc. El uso de JSC reduce drásticamente el consumo de memoria en servidores HTTP y pipelines de datos:  
![][image3]  
Para evitar que el proceso sufra una terminación forzada por falta de memoria (Out-of-Memory / OOM Killer), se debe implementar un flujo de streaming extremo a extremo mediante Web Streams. Bun ofrece un soporte de primer nivel para la API estándar de Web Streams (ReadableStream, WritableStream, TransformStream), optimizada para evitar copias redundantes en memoria. Al utilizar la lectura por chunks binarios con buffers controlados, el recolector de basura de JSC puede liberar la memoria ocupada por los objetos previos inmediatamente.  
Durante esta segmentación de red, los límites de los fragmentos de bytes (chunks) emitidos por el socket TCP pueden cortar arbitrariamente la codificación multibyte UTF-8, provocando la emisión de caracteres incompletos que invalidan la estructura JSON.14 Para blindar el proceso, se incorpora de manera obligatoria la clase estándar TextDecoder configurada con el parámetro { stream: true }. Esta utilidad intercepta los fragmentos binarios, detecta si un carácter multibyte ha sido segmentado en la frontera del buffer y almacena temporalmente los bytes huérfanos hasta la recepción del siguiente fragmento de datos, garantizando una reconstrucción de caracteres segura.  
Adicionalmente, si el ritmo de descarga de red es superior a la capacidad del sistema para procesar o encolar las tareas, se generará una saturación en la memoria del host. La contrapresión (Backpressure) se gestiona de forma automática al estructurar la canalización mediante los métodos de Web Streams de Bun, como .pipeTo() o .pipeThrough(), que propagan de forma correcta las señales de pausa y reanudación a lo largo de la conexión TCP:  
![][image4]

## **Sistema de Mensajería Distribuido con BullMQ: Coordinación de Tareas y Workers en Hilos Aislados en Bun**

El procesamiento distribuido a escala masiva requiere un intermediario de mensajería persistente que actúe como amortiguador de carga. Redis asume este rol en la arquitectura BullMQ, garantizando la persistencia del estado de las tareas incluso ante fallos críticos del sistema o reinicios abruptos de las instancias trabajadoras. Para evitar excepciones de inicio y fallos de asincronía en las conexiones subyacentes gestionadas por ioredis, es un requisito estricto configurar la propiedad maxRetriesPerRequest en null dentro de los parámetros de conexión de Redis de BullMQ.  
El mayor riesgo operativo en un entorno de ejecución de JavaScript de un solo hilo radica en el procesamiento intensivo de operaciones de CPU en el bucle de eventos (Event Loop).15 La normalización de cadenas de texto complejas, la conversión de formatos de fecha inconsistentes y el cálculo numérico sobre millones de registros consumen recursos de procesamiento de forma continua.15 Si estas operaciones se ejecutan en el hilo principal del Worker, el bucle de eventos permanecerá bloqueado y no podrá enviar los mensajes periódicos de mantenimiento de bloqueo (Heartbeats) que BullMQ y Redis requieren para certificar la salud de la tarea.15 Como consecuencia, el orquestador asume que el proceso ha fallado y clasifica el trabajo como "estancado" (stalled), lo que inicia ciclos infinitos de ejecución duplicada y satura el sistema.15  
Para garantizar un aislamiento total en Bun, la arquitectura utiliza procesadores aislados (Sandboxed Processors).15 Al configurar el Worker para apuntar a la ruta absoluta de un archivo de procesamiento TypeScript nativo (.ts) y habilitar la opción de hilos trabajadores (useWorkerThreads: true), Bun ejecuta el procesamiento de datos en hilos de ejecución nativos paralelos mediante su implementación optimizada de hilos de soporte. Al contrario que en otros entornos, Bun admite la ejecución directa de archivos de TypeScript sin necesidad de un paso de compilación previo en desarrollo o producción. La siguiente tabla detalla el comportamiento comparativo de los diferentes modelos de ejecución disponibles en Bun para la gestión de colas masivas:

| Métrica / Atributo | Worker Estándar (Single Thread) | Worker Sandboxed (Child Process) | Worker Sandboxed (Worker Threads) |
| :---- | :---- | :---- | :---- |
| **Bloqueo del Event Loop Maestro** | Crítico. Afecta directamente al temporizador de Heartbeats y genera falsos fallos.15 | Ninguno. El procesamiento ocurre en un proceso del sistema operativo independiente. | Ninguno. El procesamiento ocurre en un hilo nativo de Bun aislado. |
| **Aislamiento ante Fallos Críticos (Crash Safety)** | Nulo. Una excepción no capturada en el análisis de datos derriba todo el daemon de la cola. | Absoluto. La caída del subproceso es capturada por el maestro, quien relanza el worker de forma segura. | Alto. La caída del hilo es capturada por el maestro de BullMQ de forma segura. |
| **Consumo de Memoria por Instancia** | Mínimo. Comparte el mismo espacio de direccionamiento de Bun. | Elevado. Requiere la inicialización completa del entorno de ejecución de Bun por proceso.15 | Moderado. Duplica el runtime de Bun en hilos independientes, siendo significativamente más eficiente. |
| **Eficiencia en Comunicación (IPC)** | Máxima. El acceso a memoria es compartido directamente. | Baja. Requiere serialización e intercambio de datos a través de pipes del sistema operativo. | Media-Alta. Permite un paso de datos rápido y eficiente entre hilos del mismo proceso maestro. |

## **Normalización del Modelo de Datos Compuesto, Reconciliación de Duplicados y Limpieza de Atributos**

La unificación de las fuentes SECOP I y SECOP II expone discrepancias conceptuales profundas debido al cambio de naturaleza del sistema de contratación nacional. SECOP I operaba de forma pasiva, recopilando la información registrada manualmente por funcionarios estatales a través de formularios planos sin validaciones estrictas. SECOP II, en cambio, se comporta como un sistema transaccional robusto apoyado en bases de datos relacionales, donde los hitos del proceso y las adiciones presupuestales se almacenan de forma separada.  
Un desafío central identificado en el procesamiento de SECOP II es la existencia de registros duplicados para un mismo proceso de contratación.4 De acuerdo con análisis analíticos previos sobre la base de datos de procesos de SECOP II (p6dx-8zbt), existe una redundancia estructural equivalente al 3.9% de las filas de la tabla de procesos debido a modificaciones en los pliegos de condiciones o reenvíos de información de las entidades compradoras.8 Para construir un almacén de datos consistente, es imperativo implementar un filtro de deduplicación que agrupe los registros por el identificador único del proceso (id\_del\_proceso). En presencia de filas duplicadas, la regla de negocio debe conservar únicamente el registro con la fecha de publicación más antigua para determinar el inicio del proceso, y mapear de forma complementaria las modificaciones o adiciones cruzando el identificador del proceso con la tabla de contratos y adiciones.8  
A nivel relacional, la unificación requiere entrelazar de manera correcta los procesos de contratación, los contratos resultantes y sus respectivas modificaciones 8:

┌─────────────────────────────────┐  
│     SECOP II \- PROCESOS         │  
│     (id\_del\_proceso)            │  ◄─── 3.9% Duplicados agrupados y deduplicados   
└────────────────┬────────────────┘  
                 │ (1 : N)  
                 ▼  
┌─────────────────────────────────┐  
│     SECOP II \- CONTRATOS        │  
│     (id\_del\_portafolio)         │  ◄─── Agrega variables del proceso (ofertas, publicidad)   
└────────────────┬────────────────┘  
                 │ (1 : N)  
                 ▼  
┌─────────────────────────────────┐  
│     SECOP II \- ADICIONES        │  
│     (id\_del\_contrato)           │  ◄─── Registra sobrecostos y retrasos en tiempo   
└─────────────────────────────────┘

Esta unión de tablas permite generar un modelo relacional unificado a partir de las variables analíticas de SECOP I y SECOP II, estructurando el esquema final según la siguiente lógica de mapeo:

| Entidad Lógica Unificada | Atributo SECOP I (Origen) | Atributo SECOP II (Origen) | Tipo de Dato (Destino) | Regla de Transformación y Sanitización |
| :---- | :---- | :---- | :---- | :---- |
| **process\_key** | numero\_de\_proceso | id\_del\_proceso | VARCHAR(100) UNIQUE | Eliminación de espacios en blanco redundantes, unificación de mayúsculas y supresión de caracteres especiales no alfanuméricos. |
| **entity\_nit** | nit\_de\_la\_entidad | nit\_entidad | VARCHAR(20) | Supresión absoluta de puntos, guiones y dígitos de verificación adicionales (-D). |
| **base\_budget** | cuantia\_proceso | precio\_base | NUMERIC(18,2) | Cast numérico forzado. Limpieza de símbolos de moneda ($, COP), reemplazo de comas decimales e imputación de cero ante valores nulos.13 |
| **published\_date** | fecha\_de\_cargue | fecha\_de\_publicacion\_del | TIMESTAMP WITH TIME ZONE | Normalización de husos horarios. Conversión de formatos dispares y control de la zona horaria de Colombia (COT / UTC-5) a estándar UTC. |
| **procurement\_method** | modalidad\_de\_contratacion | modalidad\_de\_contratacion | VARCHAR(120) | Mapeo mediante una tabla de correspondencia para unificar modismos e inconsistencias históricas entre SECOP I y SECOP II. |
| **unspsc\_code** | N/D | codigo\_pci (o equivalentes) | INTEGER | Catalogación taxonómica basada en el estándar UNSPSC para agrupar bienes y servicios en categorías generales. |

## **Implementación de Referencia en TypeScript: Arquitectura de Ingesta y Transformación en Bun**

Para garantizar la correcta ejecución de la infraestructura, se configuran los módulos del proyecto de TypeScript. En el desarrollo con Bun, no es necesario realizar una transpilación previa para la ejecución de los workers, ya que Bun maneja nativamente archivos .ts en tiempo de ejecución. El archivo de configuración tsconfig.json se utiliza exclusivamente para configurar el soporte de tipos e interfaces de TypeScript bajo Bun:

JSON  
{  
  "compilerOptions": {  
    "target": "ES2022",  
    "module": "ESNext",  
    "moduleResolution": "bundler",  
    "strict": true,  
    "skipLibCheck": true,  
    "resolveJsonModule": true,  
    "types": \["bun-types"\]  
  },  
  "include": \["src/\*\*/\*"\]  
}

La inicialización segura de las colas de BullMQ exige la centralización de las instancias para mitigar la sobrecarga de conexiones sobre Redis.17 El siguiente fragmento de código implementa un registro de colas global basado en un patrón de Singleton adaptado a Bun que administra los ciclos de vida de conexión de red para la base de datos de mensajería:

TypeScript  
// Archivo: src/infrastructure/queue-registry.ts  
import { Queue, QueueEvents } from 'bullmq';  
import IORedis from 'ioredis';

const connection \= new IORedis({  
  host: process.env.REDIS\_HOST || 'localhost',  
  port: parseInt(process.env.REDIS\_PORT || '6379'),  
  maxRetriesPerRequest: null, // Requisito ineludible para BullMQ  
});

type RegisteredQueue \= {  
  queue: Queue;  
  queueEvents: QueueEvents;  
};

const registeredQueues: Record\<string, RegisteredQueue\> \= {};

export function registerQueue(name: string): Queue {  
  if (\!registeredQueues\[name\]) {  
    const queue \= new Queue(name, { connection });  
    const queueEvents \= new QueueEvents(name, { connection });  
    registeredQueues\[name\] \= { queue, queueEvents };  
  }  
  return registeredQueues\[name\].queue;  
}

El proceso de descarga y segmentación de red asume la responsabilidad de consumir la API SODA, decodificar el flujo binario protegiendo la integridad de los caracteres UTF-8 mediante TextDecoder nativo y transmitir de manera secuencial los datos aplicando contrapresión activa en función de la velocidad de inserción en la cola de trabajo de BullMQ:

TypeScript  
// Archivo: src/infrastructure/soda-streamer.ts  
import { registerQueue } from './queue-registry';

const importQueue \= registerQueue('secop-import');

export async function executeSodaIngestion(endpointUrl: string, appToken: string): Promise\<number\> {  
  let recordCount \= 0;

  // fetch nativo y altamente optimizado en Bun  
  const response \= await fetch(endpointUrl, {  
    headers: {  
      'X-App-Token': appToken,  
      'Accept': 'application/json'  
    }  
  });

  if (\!response.ok ||\!response.body) {  
    throw new Error(\`Fallo de conexión SODA API HTTP ${response.status}: ${response.statusText}\`);  
  }

  const reader \= response.body.getReader();  
  const decoder \= new TextDecoder('utf-8'); // Evita la fragmentación de caracteres UTF-8  
  let remainder \= '';

  // Procesamiento por chunks utilizando Web Streams nativos de Bun  
  while (true) {  
    const { done, value } \= await reader.read();  
    if (done) break;

    remainder \+= decoder.decode(value, { stream: true });  
    const lines \= remainder.split('\\n');  
    remainder \= lines.pop() || ''; // Almacena temporalmente la última línea incompleta 

    for (const line of lines) {  
      if (\!line.trim()) continue;  
        
      const rawRecord \= JSON.parse(line);  
      recordCount++;

      // Contrapresión controlada de forma asíncrona mediante el await de BullMQ  
      await importQueue.add('process-record', {  
        origin: endpointUrl.includes('p6dx-8zbt')? 'SECOP\_II' : 'SECOP\_I',  
        data: rawRecord  
      }, {  
        removeOnComplete: true,  
        removeOnFail: 1000  
      });  
    }  
  }

  // Procesar cualquier residuo final de la transmisión  
  const finalTail \= remainder \+ decoder.decode();  
  if (finalTail.trim()) {  
    const rawRecord \= JSON.parse(finalTail);  
    recordCount++;  
    await importQueue.add('process-record', {  
      origin: endpointUrl.includes('p6dx-8zbt')? 'SECOP\_II' : 'SECOP\_I',  
      data: rawRecord  
    });  
  }

  return recordCount;  
}

Para procesar de forma aislada las tareas de normalización y persistencia de datos, se despliega un subproceso de hilos (Sandboxed Processor). El siguiente bloque expone la lógica transaccional de análisis estructural, tratamiento de fechas corruptas, resolución de duplicidades y formateo financiero de tipos que se ejecuta directamente en los hilos de soporte de TypeScript nativos de Bun:

TypeScript  
// Archivo: src/workers/processors/import-processor.ts  
import { SandboxedJob } from 'bullmq';

interface SecopRawPayload {  
  id\_del\_proceso?: string;  
  numero\_de\_proceso?: string;  
  entidad?: string;  
  nombre\_de\_la\_entidad?: string;  
  nit\_entidad?: string;  
  nit\_de\_la\_entidad?: string;  
  precio\_base?: string | number;  
  cuantia\_proceso?: string | number;  
  fecha\_de\_publicacion\_del?: string;  
  fecha\_de\_cargue?: string;  
}

function sanitizeNit(nit?: string): string | null {  
  if (\!nit) return null;  
  // Limpieza de caracteres no numéricos para consolidar NITs  
  const clean \= nit.replace(/\[^0-9\]/g, '');  
  return clean.length \> 0? clean : null;  
}

function parseFinancialValue(value?: string | number): number {  
  if (value \=== undefined || value \=== null) return 0;  
  if (typeof value \=== 'number') return value;

  // Supresión de caracteres de moneda y conversión de separadores de miles decimales   
  const clean \= value  
   .replace(/\[$\\s\]/g, '')  
   .replace(/\\./g, '')  
   .replace(/,/g, '.');

  const result \= parseFloat(clean);  
  return isNaN(result)? 0 : result;  
}

function parseDateIso(rawDate?: string): string | null {  
  if (\!rawDate) return null;  
  const parsedTimestamp \= Date.parse(rawDate);  
    
  if (isNaN(parsedTimestamp)) {  
    // Manejo adaptativo ante formatos no estructurados habituales en SECOP I  
    const regexMatch \= rawDate.match(/^(\\d{2})\\/(\\d{2})\\/(\\d{4})$/);  
    if (regexMatch) {  
      const formattedIso \= \`${regexMatch\[1\]}-${regexMatch\[2\]}-${regexMatch\[3\]}T00:00:00.000Z\`;  
      const fallbackTimestamp \= Date.parse(formattedIso);  
      return isNaN(fallbackTimestamp)? null : new Date(fallbackTimestamp).toISOString();  
    }  
    return null;  
  }  
  return new Date(parsedTimestamp).toISOString();  
}

export default async function importProcessor(job: SandboxedJob): Promise\<any\> {  
  const { origin, data } \= job.data as { origin: 'SECOP\_I' | 'SECOP\_II'; data: SecopRawPayload };

  // Polimorfismo adaptativo según el origen del esquema \[18, 19\]  
  const processId \= origin \=== 'SECOP\_II'? data.id\_del\_proceso : data.numero\_de\_proceso;  
  const entityName \= origin \=== 'SECOP\_II'? data.entidad : data.nombre\_de\_la\_entidad;  
  const entityNit \= origin \=== 'SECOP\_II'? data.nit\_entidad : data.nit\_de\_la\_entidad;  
  const baseValue \= origin \=== 'SECOP\_II'? data.precio\_base : data.cuantia\_proceso;  
  const rawDate \= origin \=== 'SECOP\_II'? data.fecha\_de\_publicacion\_del : data.fecha\_de\_cargue;

  if (\!processId) {  
    throw new Error('Registro inválido: Ausencia de identificador único de proceso.');  
  }

  const normalized \= {  
    processKey: processId.trim().toUpperCase(),  
    entityName: (entityName || 'ENTIDAD INDEFINIDA').trim().toUpperCase(),  
    entityNit: sanitizeNit(entityNit),  
    baseValue: parseFinancialValue(baseValue),  
    publishedDate: parseDateIso(rawDate),  
    originSystem: origin,  
  };

  await job.updateProgress(100);

  return normalized;  
}

Para inicializar el Worker principal apuntando directamente al archivo TypeScript de procesamiento aislado:

TypeScript  
// Archivo: src/workers/worker.ts  
import { Worker } from 'bullmq';  
import path from 'path';

const connection \= {  
  host: process.env.REDIS\_HOST || 'localhost',  
  port: parseInt(process.env.REDIS\_PORT || '6379'),  
  maxRetriesPerRequest: null,  
};

// En Bun, pasamos la ruta absoluta del archivo.ts directamente sin transpilación  
const worker \= new Worker(  
  'secop-import',  
  path.join(\_\_dirname, 'processors/import-processor.ts'),   
  {  
    connection,  
    concurrency: 5,  
    useWorkerThreads: true, // Hilos de soporte de JavaScriptCore en Bun  
  }  
);

worker.on('completed', (job, result) \=\> {  
  console.log(\`Job \[${job.id}\] normalizado correctamente:\`, result);  
});

worker.on('failed', (job, error) \=\> {  
  console.error(\`Job \[${job?.id}\] falló durante el procesamiento:\`, error);  
});

## **Recomendaciones de Infraestructura, Afinamiento de Memoria y Conclusiones en Bun**

La ingesta y consolidación analítica de más de 15 millones de registros de SECOP I y II en Bun se beneficia del uso óptimo de la memoria física y del motor de ejecución de hilos optimizado de JavaScriptCore (JSC). A diferencia de otros motores de ejecución de JS, JSC gestiona la memoria de manera más ágil y no requiere pre-asignar bloques masivos fijos de Heap Memory, lo que resulta en un consumo de RAM significativamente inferior (entre un 25% y un 40% menos en tareas concurrentes).  
Para monitorizar y controlar de forma preventiva el consumo de recursos de nuestro proceso de ingesta en Bun, se puede acceder directamente a las estadísticas del montón de JSC (JSC Heap) a nivel de código mediante el módulo nativo bun:jsc:

TypeScript  
import { heapStats } from 'bun:jsc';

// Ejecutar periódicamente para rastrear picos de asignación de memoria  
console.log(heapStats());

Adicionalmente, se puede arrancar el runtime de Bun con la variable de entorno MIMALLOC\_SHOW\_STATS=1 para visualizar estadísticas detalladas sobre el rendimiento y liberación de memoria física por parte del asignador de memoria nativo mimalloc al finalizar el proceso:

Bash  
MIMALLOC\_SHOW\_STATS=1 bun src/workers/worker.ts

Si es necesario depurar una fuga de memoria (Memory Leak) provocada por acumulación de registros pesados en algún buffer intermedio, Bun permite generar snapshots de memoria V8-compatibles directamente para su inspección en Chrome DevTools utilizando el parámetro \--heap-prof:

Bash  
bun \--heap-prof src/workers/worker.ts

A nivel de persistencia en PostgreSQL, la estrategia de inserción masiva debe evitar de forma absoluta las operaciones unitarias síncronas de tipo INSERT. El importador debe estructurar bloques de inserción por lotes (Bulk Inserts) de un tamaño de ventana parametrizado entre 5,000 y 10,000 registros, gestionando de forma explícita la resolución de conflictos sobre la clave primaria unificada mediante directivas de base de datos relacional:

SQL  
INSERT INTO unified\_secop\_records (  
    process\_key, entity\_name, entity\_nit, base\_value, published\_date, origin\_system  
) VALUES...  
ON CONFLICT (process\_key) DO UPDATE SET  
    entity\_name \= EXCLUDED.entity\_name,  
    entity\_nit \= EXCLUDED.entity\_nit,  
    base\_value \= EXCLUDED.base\_value,  
    published\_date \= EXCLUDED.published\_date,  
    origin\_system \= EXCLUDED.origin\_system  
WHERE EXCLUDED.published\_date \>= unified\_secop\_records.published\_date;

Esta regla de exclusión de actualización garantiza que las filas duplicadas (como el 3.9% de discrepancias estructurales mapeadas en el conjunto de datos de procesos de SECOP II) se resuelvan conservando de manera determinista la información más actualizada disponible en la plataforma de datos abiertos, impidiendo la corrupción de métricas financieras de contratación consolidada.4 El rendimiento general de este pipeline de ingesta, respaldado por la asincronía optimizada y nativa de Bun, asegura un escalamiento robusto y de alto rendimiento que reduce drásticamente los costos de infraestructura.

#### **Fuentes citadas**

1. JSON Streaming in Node: 10 Traps and Safer Patterns | by Thinking ..., acceso: mayo 20, 2026, [https://medium.com/@ThinkingLoop/json-streaming-in-node-10-traps-and-safer-patterns-d507d10bcc7c](https://medium.com/@ThinkingLoop/json-streaming-in-node-10-traps-and-safer-patterns-d507d10bcc7c)  
2. How to Use BullMQ Sandboxed Processors \- OneUptime, acceso: mayo 20, 2026, [https://oneuptime.com/blog/post/2026-01-21-bullmq-sandboxed-processors/view](https://oneuptime.com/blog/post/2026-01-21-bullmq-sandboxed-processors/view)  
3. Application Tokens | Socrata \- Data & Insights, acceso: mayo 20, 2026, [https://dev.socrata.com/docs/app-tokens.html](https://dev.socrata.com/docs/app-tokens.html)  
4. streaming a large json object to a file to avoid memory allocation error : r/node \- Reddit, acceso: mayo 20, 2026, [https://www.reddit.com/r/node/comments/4vmloi/streaming\_a\_large\_json\_object\_to\_a\_file\_to\_avoid/](https://www.reddit.com/r/node/comments/4vmloi/streaming_a_large_json_object_to_a_file_to_avoid/)  
5. VigIA: prioritizing public procurement oversight with machine learning models and risk indices | Data & Policy \- Cambridge University Press & Assessment, acceso: mayo 20, 2026, [https://www.cambridge.org/core/journals/data-and-policy/article/vigia-prioritizing-public-procurement-oversight-with-machine-learning-models-and-risk-indices/34D04747A94A7099E3CD8B91221338ED](https://www.cambridge.org/core/journals/data-and-policy/article/vigia-prioritizing-public-procurement-oversight-with-machine-learning-models-and-risk-indices/34D04747A94A7099E3CD8B91221338ED)  
6. How to query more than 1000 rows of a dataset \- Socrata Support \- Data & Insights, acceso: mayo 20, 2026, [https://support.socrata.com/hc/en-us/articles/202949268-How-to-query-more-than-1000-rows-of-a-dataset](https://support.socrata.com/hc/en-us/articles/202949268-How-to-query-more-than-1000-rows-of-a-dataset)  
7. The OFFSET Clause | Socrata \- Data & Insights, acceso: mayo 20, 2026, [https://dev.socrata.com/docs/queries/offset.html](https://dev.socrata.com/docs/queries/offset.html)  
8. Use socrata opendata in a TimeXtender REST data source to do offset and limit pagination, acceso: mayo 20, 2026, [https://support.timextender.com/data-sources-112/use-socrata-opendata-in-a-timextender-rest-data-source-to-do-offset-and-limit-pagination-2078](https://support.timextender.com/data-sources-112/use-socrata-opendata-in-a-timextender-rest-data-source-to-do-offset-and-limit-pagination-2078)  
9. How to Stream Large Files from S3 in Node.js \- OneUptime, acceso: mayo 20, 2026, [https://oneuptime.com/blog/post/2026-02-12-stream-large-files-s3-nodejs/view](https://oneuptime.com/blog/post/2026-02-12-stream-large-files-s3-nodejs/view)  
10. Sandboxed processors | BullMQ, acceso: mayo 20, 2026, [https://docs.bullmq.io/guide/workers/sandboxed-processors](https://docs.bullmq.io/guide/workers/sandboxed-processors)  
11. Integrating BullMQ into a Node application \- Jacob Paris, acceso: mayo 20, 2026, [https://www.jacobparis.com/content/bullmq-integration-guide](https://www.jacobparis.com/content/bullmq-integration-guide)  
12. Using $limit and $offset to get more than 1000 rows on a SODA API \- Stack Overflow, acceso: mayo 20, 2026, [https://stackoverflow.com/questions/71804530/using-limit-and-offset-to-get-more-than-1-000-rows-on-a-soda-api](https://stackoverflow.com/questions/71804530/using-limit-and-offset-to-get-more-than-1-000-rows-on-a-soda-api)  
13. Workers | BullMQ, acceso: mayo 20, 2026, [https://docs.bullmq.io/guide/workers](https://docs.bullmq.io/guide/workers)  
14. SECOP II \- Procesos de Contratación | Socrata API Foundry, acceso: mayo 20, 2026, [https://dev.socrata.com/foundry/www.datos.gov.co/p6dx-8zbt](https://dev.socrata.com/foundry/www.datos.gov.co/p6dx-8zbt)

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,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>

[image4]: <data:image/png;base64,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>
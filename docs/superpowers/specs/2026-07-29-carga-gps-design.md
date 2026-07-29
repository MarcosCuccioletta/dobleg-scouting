# Carga de GPS — Diseño

Fecha: 2026-07-29
Estado: aprobado por el usuario (pendiente de plan de implementación)

## Problema

Los datos físicos (GPS) de los jugadores de la agencia llegan como PDFs que manda
cada club, con formatos y nombres de métrica distintos. Hoy se cargan a mano en un
Google Sheet publicado como CSV (73 filas), que la app lee en `csvService` y muestra
en la pestaña **Físico** de la ficha (`GPSTab`). Ese flujo tiene tres problemas:

1. Cargar un partido implica salir de la app y editar el Sheet a mano.
2. El esquema es de 17 métricas fijas y no cubre lo que mandan los clubes. El PDF de
   Estudiantes RC trae `Dist AI (16)`, `DZ4 (16-20)`, `Dist Acele` (metros acelerando,
   no cantidad de aceleraciones) — ninguna encaja en las columnas actuales.
3. No se puede editar ni borrar una carga desde la app, y el CSV arrastra la latencia
   de Google Sheets.

## Objetivo

Una página nueva **Carga de GPS** (submenú Inicio, debajo de Calendario) con dos modos
—automático arrastrando el PDF, y manual— que escriba en Supabase con un catálogo de
métricas extensible, y que la pestaña Físico lea de ahí.

Una carga = **un jugador en un partido**.

## Decisiones tomadas

| Decisión | Elección |
|---|---|
| Storage | Supabase. Se migran las 73 filas del Sheet; el Sheet queda de archivo. |
| Carga automática | Parser propio en el navegador (pdf.js) + pantalla de revisión. Sin IA, sin API keys. |
| Métricas | Catálogo único global + tabla de alias. Los nombres desconocidos se mapean una vez y quedan aprendidos. |
| Multi-jugador | El parser detecta a todos los jugadores DG del archivo y el usuario tilda cuáles guardar. |
| Responsive | Desktop, tablet, mobile y app nativa (Capacitor) como ciudadanos de primera. |

## Modelo de datos

Migración nueva en `supabase/migrations/`. RLS igual que `player_videos`:
lectura pública (`FOR SELECT USING (true)`), escritura para `authenticated`.

### `gps_metrics` — catálogo

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigint identity PK | |
| `key` | text unique | slug estable, ej. `distancia_total`. Es la clave dentro del jsonb. |
| `label` | text | "Distancia Total" |
| `unit` | text | "m", "km/h", "" |
| `decimals` | int default 0 | cómo se formatea |
| `category` | text | `locomotor` / `mecanico` / `otro` |
| `sort_order` | int | orden en la UI |
| `is_active` | bool default true | ocultar sin borrar historial |
| `created_at`, `created_by`, `created_by_name` | | quién la creó |

Semilla: las 17 métricas que hoy son columnas del Sheet (las 25 columnas menos las 8 de
contexto: fecha, jugador, equipo, rival, resultado, competencia, minutos y subido).

### `gps_metric_aliases` — aprendizaje del parser

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigint identity PK | |
| `metric_id` | bigint FK → `gps_metrics` | |
| `alias` | text unique | normalizado (minúsculas, sin acentos, espacios colapsados) |
| `source` | text null | de qué club/formato vino, informativo |

Ej: `dist rel x min` → `metros_por_min`.

### `gps_entries` — una fila por jugador y partido

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK default gen_random_uuid() | |
| `player_key` | text | `agencyKey(nombre)`, misma identidad que videos |
| `player_name` | text | nombre para mostrar |
| `match_date` | date | |
| `equipo`, `rival`, `competencia`, `resultado` | text | `resultado` opcional |
| `minutos` | numeric null | campo fijo, no métrica |
| `metrics` | jsonb not null | `{"distancia_total": 10222, "vel_max": 30.8}` |
| `source` | text | `manual` \| `pdf` |
| `file_name` | text null | nombre del PDF de origen |
| `created_by`, `created_by_name` | | |
| `created_at`, `updated_at` | timestamptz | |

Índices: `player_key`, `match_date`, y **único `(player_key, match_date, lower(rival))`**.

> Ajuste hecho durante la implementación: la clave única iba a ser `(player_key,
> match_date)`, pero en el Sheet hay cinco partidos distintos de Echeverría con la
> misma fecha (se cargó la fecha de subida, no la del partido). Sin el rival en la
> clave, la migración habría colapsado esos cinco en uno.

Rival y competencia no tienen tabla propia: las sugerencias salen de los valores
distintos ya cargados en `gps_entries`.

## Servicio

`src/services/gpsService.ts`, siguiendo el patrón de `playerVideosService`:

- `fetchGpsMetrics()` → catálogo + aliases.
- `createGpsMetric(input)` → alta desde la UI, devuelve la métrica creada.
- `addMetricAlias(metricId, alias, source)`.
- `fetchAllGpsEntries()` / `fetchPlayerGpsEntries(playerKey)`.
- `saveGpsEntries(entries[])` → insert con manejo del conflicto `(player_key, match_date)`.
- `updateGpsEntry(id, patch)` / `deleteGpsEntry(id)`.
- `distinctRivals()` / `distinctCompetitions()` — derivadas de las entradas.

## Parser de PDF

Módulo `src/features/gps/parser/`, sin dependencias de React para poder testearlo solo.
Dependencia nueva: `pdfjs-dist`.

- **`extractItems.ts`** — abre el PDF con pdf.js y devuelve, por página, los items de
  texto con sus coordenadas `{ str, x, y, width, page }`. Se usan coordenadas y no el
  orden de lectura, que en estos PDFs sale desordenado.
- **`buildTable.ts`** — agrupa items en filas por Y (con tolerancia), asigna columnas por
  X, e identifica la fila de encabezado (la que tiene ≥3 celdas que parecen nombres de
  métrica). Descarta filas de agregado: las que empiezan con `%` o matchean
  `Sumatoria|Equipo|Total|Promedio|Valor más Alto|1 Tiempo|2 Tiempo`.
- **`parseNumber.ts`** — coma decimal a punto, separador de miles, vacío → `null`.
- **`matchPlayers.ts`** — matchea la celda de nombre contra el roster DG con
  normalización NFD sin acentos. Formatos soportados: nombre completo, apellido solo,
  `I. Apellido`, y **`Apellido I`** (así aparece "Gonzalez G" = Gonzalo González).
  Si un nombre matchea a más de un jugador DG (ej. "Watson" → Franco o Nicolás)
  devuelve el candidato ambiguo para que lo resuelva la pantalla de revisión.
- **`mapColumns.ts`** — resuelve cada encabezado contra el catálogo y los alias.
  Devuelve `{ header, metricId | null, confidence }`. Lo no resuelto lo decide el usuario.
- **`inferContext.ts`** — best effort sobre el texto suelto del PDF (ej.
  "Fecha n1 vs Tigre (L)") para prefillear rival y fecha. Nunca bloquea: lo que no se
  puede inferir queda vacío y el usuario lo completa.

El parser **no escribe nada**. Devuelve una estructura de propuesta que consume la UI.

## UI

Ruta `/carga-gps`, `GpsUploadPage` lazy en `App.tsx`, entrada nueva en `inicioGroup.items`
de `Navbar.tsx` debajo de Calendario. El bottom nav mobile (5 destinos fijos) no cambia.

Control segmentado arriba: **Automática** | **Manual**.

### Manual

1. **Contexto del partido**: jugador (buscador sobre el roster DG), fecha, equipo
   (prefill con el club actual del jugador), rival y competencia (input con sugerencias
   de lo ya cargado), resultado, minutos.
2. **Métricas**: la lista del catálogo activo, cada una con su input de valor. Botón
   **+ Nueva métrica** (label, unidad, decimales, categoría) que la crea en el catálogo
   y queda disponible desde ese momento para todas las cargas futuras.
3. Guardar → confirmación y la carga aparece en el listado de abajo.

### Automática

1. **Dropzone**: arrastrar o clickear para elegir el PDF. En mobile abre el selector de
   archivos del sistema.
2. Parseo local → **pantalla de revisión**, que es donde se confirma todo:
   - contexto del partido prefilleado y editable;
   - jugadores DG detectados, con checkbox por cada uno (marcados por defecto) y
     resolución de ambigüedades cuando las haya;
   - por cada columna, a qué métrica mapea: reconocida (badge verde) o un selector
     *métrica existente* / *crear nueva* / *ignorar*. Lo que se elige se guarda como
     alias y la próxima vez se reconoce solo;
   - vista previa de los valores que se van a guardar.
3. Confirmar → se guardan todas las filas tildadas. Si alguna choca con el índice único
   `(player_key, match_date)`, se avisa y se ofrece reemplazar.

Nada se persiste antes de confirmar.

### Últimas cargas

Debajo de ambos modos, la lista de las últimas entradas con jugador, fecha, rival,
origen (manual/PDF) y acciones de editar y borrar.

### Responsive

Se diseña mobile-first y se verifica en los tres anchos. En mobile los formularios son de
una columna con inputs de tamaño táctil; la tabla de revisión pasa a tarjetas por jugador
en vez de scroll horizontal. Nada depende de hover ni de drag & drop: el dropzone es
también un botón, y toda acción disponible al arrastrar existe como tap. Se respetan los
safe areas y el patrón visual del resto de la app (tarjetas `rounded-apple`, dark mode).

## Pestaña Físico (`GPSTab`)

- La fuente pasa a ser Supabase (`gps_entries` + catálogo) en lugar de `gpsData` del CSV.
- El selector de métricas se arma con el catálogo filtrado a las que ese jugador tiene
  cargadas, en vez de los 9 `MetricKey` hardcodeados.
- Se mantienen las tres vistas actuales (Evolución / Comparación / Resumen) y la tabla de
  historial; las columnas del historial pasan a ser las métricas disponibles del jugador.
- Formato de cada valor según `unit` y `decimals` del catálogo.

## Migración de los datos existentes

Script de una sola vez (`scripts/migrate-gps-sheet.mjs`, ejecutado a mano) que:

1. Lee el CSV publicado (`SHEET_URLS.gps`).
2. Siembra el catálogo con las 17 métricas y sus alias de cabecera del Sheet.
3. Inserta las filas en `gps_entries`, **omitiendo las métricas con valor 0**, porque
   en ese Sheet 0 significa "no disponible" y no un cero real. De las 74 filas quedan
   65: siete son la misma carga repetida y dos son repeticiones donde la única
   diferencia es el encoding roto del rival (`San Mart<?>n` vs `San Martín`), que se
   detectan por jugador + fecha + distancia total.

Después de migrar, `csvService` deja de traer `gpsData` y se saca `SHEET_URLS.gps` del
fetch inicial (mejora de arranque).

## Tests

Vitest, junto al código (`*.test.ts`), sobre lo que puede romper en silencio:

- `parseNumber`: coma decimal, miles, vacío, basura.
- `buildTable`: agrupación por coordenadas y descarte de filas de agregado, usando un
  fixture de items extraído del PDF real de Tigre.
- `matchPlayers`: `Gonzalez G` → Gonzalo González, `Lo Celso` → Francesco Lo Celso,
  ambigüedad de `Watson`, y que no matchee jugadores que no son de la agencia.
- `mapColumns`: alias conocido resuelve, desconocido devuelve `null` sin romper.
- Caso integrado: el PDF de Tigre produce dos jugadores DG con los valores esperados
  (Gonzalo González 98' / 10222 m / 30,8 km/h).

## Fuera de alcance

- Lectura de imágenes o capturas de pantalla (requiere OCR/IA). Si más adelante hace
  falta, el parser ya queda detrás de una interfaz que permite enchufar otra fuente.
- Cambios en el bottom nav mobile.
- Cualquier cambio en el scoring o en la evaluación de rendimiento.

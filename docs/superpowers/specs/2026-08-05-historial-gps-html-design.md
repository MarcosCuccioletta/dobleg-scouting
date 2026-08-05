# Historial GPS por HTML — Diseño

Fecha: 2026-08-05
Estado: en diseño (pendiente aprobación)

## Problema

Carga de GPS hoy solo lee PDF, y solo dos formas de tabla: "un partido, varios
jugadores" (`buildTable`, fila = jugador) y "un partido, un jugador, en tarjetas"
(`buildCardTable`). En la práctica también llegan reportes en HTML con el historial
completo de temporada de **un** jugador — fila = partido, no jugador — como el que
mandó el usuario para Favian Loyola (24 partidos, un `<table>` real, sin columna de
fecha). Ninguna de las dos formas actuales encaja: el uploader rechaza el HTML de
entrada ("Invalid PDF structure" al intentar leerlo con pdf.js), y aunque se
convirtiera a PDF, `buildTable` asume fila = jugador y hoy no hay forma de decirle "esta
fila es un partido". Terminó resuelto a mano con un script SQL fuera de la app.

## Objetivo

Agregar un tercer modo a Carga de GPS — **Historial** — para archivos donde cada fila
es un partido de un jugador ya elegido, en HTML o PDF. No reemplaza ni modifica
Automática ni Manual: es aditivo, sobre una pestaña nueva.

## Decisiones tomadas

| Decisión | Elección |
|---|---|
| Formatos de entrada | HTML (`<table>` real) y PDF con tabla, ambos con forma fila=partido |
| Cómo se activa | Pestaña nueva "Historial", junto a Automática / Manual. El jugador se elige *antes* de subir (selector obligatorio, a diferencia del dropdown opcional de Automática) |
| Detección de forma | Ninguna automática: el usuario elige el modo Historial a propósito. Cero riesgo de confundir esto con una tabla multi-jugador real |
| Fecha por fila | Si el archivo la trae, se usa de prefill; si no, input de fecha vacío y **obligatorio** por fila antes de poder guardar esa fila puntual |
| Guardado | Reusa `saveGpsEntries` tal cual — ya acepta un array de cargas, cada una con su propia fecha/rival/competencia. Sin cambios de backend ni de esquema |
| Mapeo de métricas | Mismo patrón que ya existe (columna → métrica del catálogo / ignorar / crear nueva), para compartir el aprendizaje de alias |

## Extracción HTML

Módulo nuevo `src/features/gps/parser/extractHtmlTable.ts`: parsea el archivo con
`DOMParser`, toma el primer `<table>` con más de una fila de datos, y devuelve
`{ headers: string[], rows: string[][] }`. Por celda, si existe un atributo `data-v`
(como en el HTML de Loyola: `data-v="240"` junto al texto "240") se usa como valor
numérico preferido; si no, se parsea el texto con la misma lógica de `parseNumber` que
ya usa el parser de PDF (coma decimal, separador de miles). Sin heurística de
coordenadas — a diferencia del PDF, HTML ya trae estructura semántica real (`<tr>`,
`<td>`), así que no hace falta reconstruir filas por posición.

## Parseo de historial

Módulo nuevo `src/features/gps/parser/buildHistoryTable.ts`:

- Recibe `{ headers, rows }` (de HTML o de una extracción PDF-a-tabla equivalente) y el
  `playerName` ya elegido en la UI.
- Clasifica cada columna con un lookup de alias fijo para **fecha / rival / competencia
  / minutos** (mismo estilo que `MINUTES_ALIASES` en `mapColumns.ts`, pero un lookup
  propio — no reusa `mapColumns` porque esa función asume que la columna 0 es un nombre
  de jugador, que acá no existe). Las columnas no reconocidas quedan como métrica
  candidata, resuelta igual que hoy contra el catálogo + alias aprendidos.
- Devuelve un array de "partidos detectados", en el mismo orden en que aparecen en el
  archivo — orden que se preserva porque en el caso real coincide con el orden
  cronológico real, aunque la fecha explícita no esté.

```ts
interface HistoryMatchRow {
  rawCells: string[]
  matchDate: string | null      // 'YYYY-MM-DD' si se pudo parsear, si no null
  rival: string
  competencia: string | null
  minutos: number | null
  values: (number | null)[]     // alineado con las columnas de métrica
}
```

## UI — pestaña Historial

1. Selector de jugador (obligatorio) + dropzone que acepta `.pdf` y `.html`.
2. Pantalla de revisión:
   - **Equipo** (campo único, arriba de todo): dentro de un mismo archivo de historial
     el jugador juega para un solo club durante todo el período, así que es un campo
     compartido para todas las filas (prefilled con el club actual del roster),
     no una columna. Igual que hoy, editable.
   - **Competencia por defecto** (campo único, opcional): se aplica a toda fila que no
     tenga su propia columna de competencia detectada. Si el archivo sí trae una
     columna de competencia por partido (como el de Loyola, con Torneo Nacional / Copa
     de la Liga / etc. por fila), esa columna manda y este campo no se usa.
   - Panel de mapeo de columnas → métrica (igual al de Automática), aplicado una sola
     vez para todas las filas.
   - Tabla de partidos detectados, una fila de UI por partido: fecha (input date,
     vacío y obligatorio si no vino del archivo), rival y competencia (prefilled,
     editables inline — competencia cae al valor por defecto si la fila no trae
     columna propia), minutos, checkbox para no cargar esa fila puntual.
3. Guardar: arma un `GpsEntryInput` por fila tildada *y con fecha completa* — las filas
   tildadas sin fecha bloquean el guardado general con un aviso puntual, no silencian el
   resto. `player_name` y `equipo` son iguales para todas las filas. Reusa
   `saveGpsEntries`, con el mismo manejo de conflictos por índice único que ya existe.

## Fuera de alcance

- Detectar automáticamente si un archivo es "historial" o "multi-jugador": el usuario
  elige el modo a propósito.
- Inferir fechas faltantes cruzando con un calendario/resultados reales (se hizo a mano
  para Loyola vía un script SQL puntual; no se automatiza acá).
- Edición de `match_date` desde "Últimas cargas" (limitación ya existente en
  `RecentGpsUploads`, no se toca en este trabajo).
- Soporte para capturas de pantalla o imágenes sin texto seleccionable/estructura HTML
  real (sigue siendo carga manual, como hoy).

## Tests

Siguiendo el patrón ya establecido en `src/features/gps/parser/*.test.ts`:

- `extractHtmlTable`: lee headers y filas de un `<table>` de fixture, prioriza
  `data-v` sobre el texto de la celda.
- `buildHistoryTable`: reconoce columna de fecha/rival/competencia/minutos por alias,
  deja `matchDate: null` cuando no hay columna de fecha, preserva el orden de filas.
- Caso integrado con un fixture HTML real (recortado del de Loyola): produce N
  partidos con `rival` y métricas correctas, y `matchDate: null` en todos (ese archivo
  no trae fecha).

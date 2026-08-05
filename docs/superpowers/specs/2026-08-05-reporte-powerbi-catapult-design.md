# Reporte Power BI/Catapult (un partido) — Diseño

Fecha: 2026-08-05
Estado: en diseño (pendiente aprobación)

## Problema

Además de los PDF con tabla multi-jugador y los HTML de historial, llegan PDF
exportados desde **Power BI Desktop** (plantilla "Reporte jugador" de Catapult): un
archivo por partido, un solo jugador, con los datos como etiquetas dentro de gráficos
(barras, radar, gauges) en vez de una tabla o de tarjetas título+valor alineadas. Ni
`buildTable` (asume grilla) ni `buildCardTable` (asume filas título/valor alternadas
con la misma cantidad de celdas) reconocen este layout.

## Alcance

Solo la página con el detalle del partido en cuestión (Primer/Segundo Tiempo:
distancia, mts/min, velocidad máxima, distancia >21 km/h, aceleraciones/
desaceleraciones >2 y >3 m/s², minutos, sprints) — **no** el mini-gráfico de evolución
de temporada que trae de fondo el archivo (esos "Fecha 1..16" no traen fecha de
calendario real y son números de gráfico, no la tabla principal; se descartan).

## Decisión

No es un modo de UI nuevo: usa exactamente la misma pantalla de revisión que ya existe
hoy para reportes individuales (`ParseReviewPanel`, con el jugador elegido de antemano
por `presetPlayerName`) — mapeo de columnas a métricas del catálogo, crear métrica
nueva, todo igual a como funciona Automática hoy. Lo único nuevo es el **extractor**.

## Extractor

Módulo nuevo `src/features/gps/parser/parsePowerBiReport.ts`, con su propia heurística
de reconocimiento de página (evita interferir con `buildTable`/`buildCardTable`):

- Detecta la página por texto ancla (`"Primer Tiempo"` + `"Segundo Tiempo"` +
  `"Minutos jugados"` en la misma página).
- A diferencia de `buildCardTable` (fila título con ≥2 celdas seguida de fila valor con
  igual cantidad de celdas numéricas), acá el patrón es **una etiqueta de texto seguida
  de cerca, en Y, por un único valor numérico** (label singular + gauge/número, no un
  bloque de N columnas). Se resuelve con la misma agrupación por filas de
  `groupRows`, pero con una regla más laxa: fila no-numérica de 1+ celdas → si la
  fila siguiente es puramente numérica, sus valores son los de esa etiqueta.
- Como el reporte trae Primer Tiempo y Segundo Tiempo lado a lado para las mismas
  métricas (distancia, mts/min, vel. máx., dist >21), se generan columnas
  distinguidas (`Distancia total (m) PT` / `Distancia total (m) ST`, etc.) — el usuario
  decide en la revisión si las carga como dos métricas separadas o si prefiere ignorar
  una y quedarse con el total del partido.
- Devuelve la misma forma `PdfTable` de una fila (headers + una fila con
  `name: playerName`), para reusar `ParseReviewPanel` sin tocarlo.

## Fuera de alcance

- El gráfico de evolución de temporada (página 4 en el ejemplo de Steimbach): mismo
  problema de fechas sin calendario real que Loyola, y son datos de gráfico de fondo,
  no la tabla principal del reporte. Si más adelante hace falta, es candidato a
  alimentar el modo Historial (mismo modelo de datos: partido → métricas), pero como
  extractor separado.
- Radar charts y gauges de comparación contra el equipo/promedio (páginas 1-2 del
  ejemplo): son contexto visual, no datos del jugador en ese partido puntual.

## Tests

- Fixture PDF real (recortado) con la página de Primer/Segundo Tiempo.
- `parsePowerBiReport`: reconoce la página ancla, separa PT/ST en columnas propias,
  ignora el resto de páginas del archivo.

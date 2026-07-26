# Informes — Tab "Impacto": conclusiones automáticas desde la API

Fecha: 2026-07-26
Estado: diseño aprobado, pendiente de plan de implementación

## Objetivo

Hoy el informe muestra datos. Falta la lectura de esos datos: las conclusiones que
hoy se escriben a mano fuera de la app ("jugó el 100% de los partidos oficiales",
"participó en el 27,6% de los goles del equipo", "es el 2º máximo asistidor del
plantel"). Todas esas frases son derivables de lo que ya está en Supabase.

Se agrega una pestaña **Impacto** al informe, con tarjetas visuales y frases
redactadas, donde cada tarjeta y cada frase se agrega o se saca del informe de
forma individual, y cualquier texto se puede reescribir a mano antes de exportar.

## Alcance

Cinco bloques de conclusiones, todos opcionales por informe:

| Bloque | Id | Contenido |
|---|---|---|
| Continuidad | `continuidad` | Partidos del club vs disputados, titularidades, minutos, % de minutos posibles, partidos perdidos por lesión |
| Peso ofensivo | `ofensivo` | Goles, asistencias, participaciones directas, % de los goles del equipo, promedios por partido y "uno cada X partidos" |
| Su lugar en el plantel | `plantel` | Puesto y share dentro del equipo en goles, asistencias, participaciones, pases clave, % de duelos ganados, regates completados, minutos y Score GG |
| Rendimiento | `rendimiento` | Score GG promedio del período, mejor partido, tendencia últimos 5 vs anteriores, % de partidos sobre su propio promedio, percentil en su posición |
| Impacto en resultados | `resultados` | Récord del equipo con él en cancha vs sin él: puntos por partido, ganados/empatados/perdidos, goles a favor |

Fuera de alcance: redacción por IA (no hay backend de modelo en el proyecto), datos
físicos GPS (ya tienen su propia pestaña), comparación contra jugadores de otros clubes
(ya existe en Comparaciones y en el radar).

## Período

Selector con presets, elegido por informe:

- `signing` — desde su llegada al club. Fecha del último traspaso hacia el club actual
  (API-Football); si no hay traspaso, la fecha de su primer partido con ese club.
- `season` — temporada en curso.
- `last10` — últimos 10 partidos del club.
- `custom` — rango de fechas a mano.

Default: `signing` si se pudo resolver una fecha de llegada, si no `season`. El
período resuelto titula la pestaña: *"Desde su llegada — 11/07/2025"*.

## Datos

Verificado contra la base con la anon key (2026-07-26):

- `fixtures` es legible por equipo y rango de fechas. Monterrey desde 01/01/2026:
  18 partidos, 25 goles a favor.
- `player_match_stats` filtrado por `team_id` + fecha del fixture trae el plantel
  completo en una sola query: 375 filas, 36 jugadores para ese mismo período.
- La suma de goles de los jugadores del plantel (25) coincide exacto con los goles
  a favor calculados desde `fixtures` (25). Sirve como control cruzado.

Tres funciones nuevas en `src/services/playerStatsService.ts`:

```ts
fetchPlayerAllMatches(playerId: number): Promise<PlayerMatchStat[]>
fetchTeamFixtures(teamId: number, fromISO: string, toISO?: string): Promise<TeamFixture[]>
fetchSquadMatchStats(teamId: number, fromISO: string, toISO?: string): Promise<SquadMatchStat[]>
```

`fetchPlayerAllMatches` existe aparte de `fetchPlayerMatchHistory` a propósito: la
función actual filtra por `detected_position` y por `match_score not null`, lo que
subcuenta los partidos jugados. Para contar continuidad hacen falta todas las filas.

El equipo del jugador sale del `team_id` de su partido más reciente. La columna
`players.current_team_id` está vacía en la base y no se usa.

## Arquitectura

Módulo de cálculo puro, sin React ni fetching: `src/features/informes/insights.ts`.

```ts
export type InsightBlockId = 'continuidad' | 'ofensivo' | 'plantel' | 'rendimiento' | 'resultados'

export interface ResolvedPeriod {
  mode: 'signing' | 'season' | 'last10' | 'custom'
  from: string          // ISO
  to: string | null
  labelKey: string      // clave i18n del título
}

// Un dato calculado. El texto NO se genera acá: se generan los valores.
export interface InsightItem {
  id: string                          // estable: 'ofe.share', 'plantel.assists', …
  kind: 'bullet'
  values: Record<string, number | string>
  tone: 'strong' | 'neutral' | 'weak'  // define qué plantilla se usa
}

export interface InsightTile {
  id: string                          // 'tile.pj', 'tile.share', …
  render: 'dots' | 'donut' | 'plain' | 'bar'
  value: string
  sub: string
  pct?: number                        // para donut y bar
}

export interface InsightGroup { id: InsightBlockId; items: InsightItem[] }

export interface InsightsResult {
  period: ResolvedPeriod
  tiles: InsightTile[]
  groups: InsightGroup[]
  warnings: string[]
}

export function computeInsights(input: InsightsInput): InsightsResult
```

El texto sale de `src/features/informes/insightText.ts`, que toma `(item, lang)` y
devuelve la frase. Así los seis idiomas del informe se resuelven en un solo lugar y
el cálculo queda testeable sin strings.

Orquestación: hook `useInformeInsights(informe)` en
`src/features/informes/useInformeInsights.ts`, con el mismo patrón de caché que
`usePlayerStats`. No vive dentro de `useInformeEnrichment` para no engordar un
archivo que ya carga cinco fuentes distintas.

## Reglas de ranking del plantel

- Métricas acumuladas (goles, asistencias, participaciones, pases clave, minutos):
  rankean contra el plantel completo. El volumen ya está dentro del número.
- Métricas promedio o porcentuales (% de duelos ganados, % de regates, Score GG):
  rankean sólo entre jugadores que superen un **umbral de minutos ajustable**. Sin
  ese filtro, un suplente con un partido lidera cualquier promedio.
  - Default: 400 minutos, o el 40% de los minutos del jugador más usado del plantel
    si ese 40% es menor — así el default sigue teniendo sentido en períodos cortos
    como "últimos 10 partidos".
  - El umbral es un **slider** en el paso 3, de 0 al total de minutos del jugador más
    usado, en pasos de 45. Al moverlo, el preview recalcula los puestos en vivo y
    muestra cuántos jugadores quedan dentro del corte.
  - El umbral elegido se guarda en el informe y viaja al export, donde se enuncia en
    la frase: *"entre los 14 jugadores con más de 400 minutos"*. El lector siempre
    sabe contra quiénes se lo comparó.
- Los arqueros se excluyen de los rankings de campo, salvo que el protagonista sea arquero.
- Si hay 3 o más compañeros de su misma posición primaria, se agrega una línea extra:
  *"1º entre los 4 extremos del plantel"*.
- Una línea de ranking sólo entra si el jugador queda en el top 5 o supera el 10% del
  total del equipo. Un 12º puesto no es una conclusión.

## Tono de las frases

Las plantillas eligen redacción según el valor, no se rellena un molde único:

- share de goles ≥ 33% → "uno de cada tres goles del equipo"; ≥ 25% → "más de uno de
  cada cuatro"; < 15% → se enuncia el porcentaje sin adorno.
- 100% de partidos → "disponibilidad total"; ≥ 90% → "prácticamente sin ausencias".
- puesto 1 → "el que más… del plantel"; puesto 2 o 3 → "2º del plantel en…".
- tendencia: diferencia menor a 0,3 de Score GG se reporta como "sostenido", no como
  subida ni bajada.

## Modelo persistido

Se agrega a `Informe` (en `types.ts`):

```ts
insights?: {
  enabled: boolean
  period: { mode: InsightPeriod['mode']; from?: string; to?: string }
  blocks: InsightBlockId[]
  hiddenItems: string[]                 // ids de tarjetas o frases desactivadas
  overrides: Record<string, string>     // id -> texto reescrito a mano
  minMinutes?: number                   // umbral del slider; ausente = default calculado
  teamMatchesOverride?: number
  teamGoalsOverride?: number
}
```

Se guarda sólo la configuración, nunca los números: se recalculan al abrir y se
congelan al exportar. Los informes van comprimidos en localStorage y este objeto
pesa poco.

## UX

**Paso 3 (Contenido)** — tarjeta nueva "Impacto (datos de la API)":

- Pills de período. Al elegir `custom`, dos inputs de fecha.
- Un toggle por bloque.
- Dentro del bloque "Su lugar en el plantel", el slider de minutos mínimos, con el
  contador de jugadores que entran en el corte y los puestos actualizándose en vivo.
- Preview en vivo debajo de cada bloque: cada tarjeta y cada frase con su checkbox
  para incluirla o sacarla, y un lápiz para reescribir el texto. El texto reescrito
  queda marcado como editado y ya no se regenera.
- Dos inputs opcionales "partidos del club" y "goles del club" para pisar los totales
  a mano cuando la cobertura de competencias esté incompleta.
- Si el informe no tiene `dbPlayerId`, la tarjeta muestra "Linkeá el jugador en el
  paso 1 para calcular el impacto" y nada más.

**Paso 4 (Preview)** — pestaña Impacto renderizada igual que el export: fila de
tarjetas arriba, grupos de frases abajo.

**Export HTML** — panel `impacto` en `exportInformeHTML.ts`, insertado después de
General. Recibe el `InsightsResult` ya resuelto por el llamador, igual que hoy recibe
`opts.evolution`. Hacen falta dos helpers nuevos en `chartSvg.ts`: `donutSvg` (para el
% de goles del equipo) y `dotsSvg` (para la fila de partidos jugados). El resto son
tarjetas de texto con el CSS que ya existe.

**i18n** — clave `tab_impacto` y las plantillas de frases en los seis idiomas.

## Casos borde

- Sin `dbPlayerId`: la pestaña no se genera y no aparece en la barra de tabs.
- Sin fixtures del club en el período: se ocultan los bloques que dependen del club
  (`ofensivo` pierde el share, `resultados` se oculta entero); los del jugador quedan.
- Discrepancia entre los goles del club por fixtures y la suma del plantel: se usa el
  mayor de los dos, se agrega un `warning` visible en el paso 3 y una nota al pie en el
  informe: "datos de las competencias con cobertura estadística".
- Menos de 3 partidos en el período: no se generan promedios ni rankings, sólo los
  totales, y el paso 3 avisa que la muestra es corta.
- Jugador con dos equipos en el período (traspaso a mitad): se toma el club del último
  partido y el período se recorta desde su primer partido con ese club.
- Traspaso sin fecha en la API: el preset `signing` no se ofrece y el default pasa a
  `season`.

## Tests

`src/features/informes/insights.test.ts`, con filas sintéticas de plantel y fixtures,
siguiendo el patrón de `chartData.test.ts`:

- continuidad con partidos sin minutos y con lesiones en el medio
- share de goles con y sin override manual
- umbral de minutos: un suplente con un partido perfecto no rankea con el default, y
  sí aparece si el umbral se baja a 0
- default del umbral en un período corto: cae al 40% de los minutos del líder en vez
  de quedarse en 400 y dejar a todo el plantel afuera
- exclusión de arqueros
- corte de top 5 / 10%
- período vacío y período con un solo partido

`src/features/informes/insightText.test.ts`: cada rama de tono devuelve la frase
esperada en español e inglés.

## Verificación

1. `npx vitest run` — suite completa en verde.
2. `npm run build` — TypeScript sin errores.
3. Prueba manual: informe de Luca Orellano (Monterrey, período temporada). Los números
   esperados según la consulta del 2026-07-26 son 15 partidos, 1.136 minutos, 3 goles,
   4 asistencias, 2º del plantel en asistencias (4 de 20), 2º en pases clave (25 de 218),
   3º en Score GG promedio (6,69), 28% de participación en los goles del equipo.
4. Exportar ese informe a HTML y confirmar que la pestaña Impacto se ve igual que en el
   preview, con el donut renderizado y sin pedir red.

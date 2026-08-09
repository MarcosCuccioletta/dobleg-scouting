# Entrenadores — Estadísticas de temporada vía Excel de Wyscout

## Contexto

Segundo sub-proyecto de la tanda de 8 sobre Entrenadores (ver `docs/superpowers/specs/2026-08-09-entrenadores-resumen-quickfixes-design.md` para el primero). Cubre el pedido: mostrar en Resumen estadísticas de temporada de un entrenador con su club (posesión, GF/GC, puntos, xG a favor/en contra, PJ/PG/PE/PP) **solo de los partidos que efectivamente dirigió**, con los datos cargados a mano por el usuario vía el Excel "Team Stats" que exporta Wyscout — porque ya se confirmó (spec anterior) que `/fixtures/statistics` de API-Football viene vacío para Primera Nacional, no hay otra fuente.

Confirmado con el usuario: sube el Excel después de cada partido (arrastrar y soltar), la plataforma avisa con un cartel cuando falta cargar uno nuevo. Mismo mecanismo para Stillitano y futuros entrenadores, sin cambios de código.

### El archivo de origen

Inspeccionado en vivo el archivo de ejemplo del usuario (`Team Stats Temperley (2).xlsx`, export de Wyscout): una sola hoja, 49 filas (1 header + 24 partidos × 2 filas — el club del usuario y el rival), 107 columnas. Fila 0 = headers agrupados: la primera columna de cada grupo tiene el label (ej. `"Tiros / a la portería "`), las columnas siguientes del mismo grupo vienen con header vacío (`""`). El layout de columnas es **fijo** (es el formato propio de este reporte de Wyscout, no varía entre exports) — columnas relevantes verificadas por índice:

| Índice | Columna | Notas |
|---|---|---|
| 0 | Fecha | `YYYY-MM-DD` |
| 1 | Partido | `"Equipo A - Equipo B X:Y"` |
| 2 | Competición | ej. `"Argentina. Primera Nacional"` |
| 4 | Equipo | nombre del equipo de ESTA fila |
| 6 | Goles | goles de este equipo en el partido |
| 7 | xG | expected goals de este equipo |
| 14 | Posesión del balón, % | posesión de este equipo |

Cada partido ocupa 2 filas consecutivas con el mismo `Fecha`+`Partido`, una por equipo — goles/xG/posesión del rival se leen de la fila del otro equipo, no hay que parsear el string `Partido`.

## 1. Tabla nueva en Supabase: `coach_match_team_stats`

Mismo patrón que `coach_match_notes` (migración `20260808120000_coach_tables.sql`, ya en main de esta rama): `coach_key` + `fixture_id` como clave, RLS permisiva de lectura, escritura restringida a `authenticated`. Nueva migración `supabase/migrations/20260809_coach_match_team_stats.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.coach_match_team_stats (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_key       TEXT NOT NULL,
  fixture_id      BIGINT NOT NULL,
  possession_pct  NUMERIC,
  xg_for          NUMERIC,
  xg_against      NUMERIC,
  raw_metrics     JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_file     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_coach_match_team_stats ON public.coach_match_team_stats(coach_key, fixture_id);

ALTER TABLE public.coach_match_team_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_coach_match_team_stats" ON public.coach_match_team_stats;
CREATE POLICY "read_coach_match_team_stats" ON public.coach_match_team_stats FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_coach_match_team_stats" ON public.coach_match_team_stats;
CREATE POLICY "write_coach_match_team_stats" ON public.coach_match_team_stats
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

Solo `possession_pct`/`xg_for`/`xg_against` son columnas propias (lo único que ninguna otra fuente tiene y que la UI de este sub-proyecto muestra); el resto de las ~100 columnas del Excel se guarda tal cual en `raw_metrics` (JSONB, claves normalizadas snake_case desde el header de Wyscout) para no perder datos y poder usarlos en una futura mejora sin pedir el Excel de nuevo. **Goles no se guarda acá** — el de la fuente canónica sigue siendo el fixture de API-Football (`AgencyFixture.goalsHome/goalsAway`), ya mostrado en toda la sección; guardarlo dos veces crearía una fuente de verdad duplicada que puede desincronizarse.

## 2. Parser del Excel

Nuevo módulo `src/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats.ts`. A diferencia del parser de GPS (`src/features/gps/parser/extractXlsxTable.ts`, confirmado sin soporte de headers agrupados — no se reusa, es de un dominio distinto y este formato es fijo, no arbitrario como los reportes de GPS), acá el layout de columnas es conocido y fijo, así que se mapea por índice directo en vez de un parser genérico:

```ts
export interface WyscoutMatchRow {
  fecha: string             // YYYY-MM-DD tal cual viene
  partido: string           // texto crudo, solo para mostrar en la revisión
  competencia: string
  equipo: string
  golesPropios: number | null
  xgPropio: number | null
  posesionPropia: number | null
  rawMetrics: Record<string, number | string | null>  // resto de las columnas, header normalizado -> valor
}

export interface WyscoutMatch {
  fecha: string
  partido: string
  competencia: string
  equipoPropio: string
  equipoRival: string
  xgFor: number | null
  xgAgainst: number | null
  possessionPct: number | null
  rawMetrics: Record<string, number | string | null>
}

export async function parseWyscoutTeamStatsXlsx(data: ArrayBuffer, ownTeamName: string): Promise<WyscoutMatch[]>
```

Pasos: leer con `xlsx` (`XLSX.read(data, {type:'array'})`, primera hoja, `sheet_to_json({header:1, defval:''})`), fila 0 = headers agrupados — forward-fill: cada celda vacía hereda el label de la última celda no vacía a su izquierda, y si dos columnas del mismo grupo terminan con el mismo nombre normalizado se les agrega sufijo `_2`/`_3` (para el `rawMetrics`, no para las 3 columnas con nombre propio). Agrupar filas de a pares por `(Fecha, Partido)` — dentro de cada par, la fila cuyo `Equipo` matchea `ownTeamName` (usando `normalizeForSearch` de `src/lib/search.ts`, ya existe y ya hace NFD/case-insensitive — se reusa, no se reimplementa) es la propia, la otra es el rival; `equipoRival` sale del campo `Equipo` de la fila contraria. Si un par no tiene ninguna fila que matchee `ownTeamName`, se descarta esa fila del resultado (partido de otro equipo, no debería pasar con un export bien armado pero no debe romper el parseo).

## 3. Matchear cada fila contra un fixture real + verificar el DT

Nuevo módulo `src/features/coaches/wyscoutTeamStats/matchFixtures.ts`:

```ts
export interface MatchedWyscoutRow {
  wyscout: WyscoutMatch
  fixture: AgencyFixture | null       // null si no se encontró match automático
  coachVerified: boolean | null       // null = todavía no chequeado / no se pudo, true/false = resultado de la API
  coachNameFromApi: string | null
}

export function matchFixtureForRow(row: WyscoutMatch, fixtures: AgencyFixture[]): AgencyFixture | null
export async function verifyCoachForFixture(fixtureId: number, coachFullName: string): Promise<{ verified: boolean; coachName: string | null }>
```

`matchFixtureForRow`: busca en `fixtures` (ya trae `fetchTeamFixtures(coach.apiTeamId)`, cacheado) una coincidencia por fecha exacta (`toArDateKey` del fixture === `row.fecha`) y nombre de rival normalizado (`normalizeForSearch`, compara `row.equipoRival` contra `homeTeam.name`/`awayTeam.name` del fixture, el que no sea el propio equipo). Sin tolerancia de fecha ±1 día en v1 — si Wyscout y API-Football difieren en la fecha por huso horario, el partido cae en "sin match" y el usuario lo resuelve a mano en la revisión (ver sección 4), más seguro que adivinar.

`verifyCoachForFixture`: reusa `fetchFixtureLineups(fixtureId)` (ya existe, sub-proyecto 1) — busca la alineación cuyo `team.id` sea el del propio club y compara `lineup.coach?.name` contra `coachFullName` (`normalizeForSearch`). Si la API no tiene lineup para ese fixture (partido viejo, o liga sin ese dato), `verified: false, coachName: null` — la fila se muestra en la revisión como "no se pudo verificar" y el usuario decide si la incluye.

## 4. Pantalla de carga y revisión

Nuevo componente `src/features/coaches/components/CoachWyscoutUploadPanel.tsx`, embebido en el tab Resumen (ver sección 6). Flujo, mismo espíritu que el `ParseReviewPanel` de carga de GPS (arrastrar → parsear → revisar/corregir → confirmar), pero sin el paso de mapeo de columnas de GPS (acá las columnas son fijas y conocidas, no hace falta que el usuario las asigne):

1. **Drop zone** (`<input type="file" accept=".xlsx">` + drag&drop, mismo patrón visual que `GpsUploadPage.tsx`). Al soltar: `file.arrayBuffer()` → `parseWyscoutTeamStatsXlsx(data, coach.club)` → `matchFixtureForRow` por fila → `verifyCoachForFixture` en paralelo para las filas con fixture encontrado.
2. **Tabla de revisión**, una fila por partido detectado: fecha, rival, resultado (si el fixture matcheó), badge de estado:
   - 🟢 verde "Domingo — confirmado por API" si `coachVerified === true`
   - 🟡 amarillo "No se pudo verificar" si `coachVerified === null/false` — checkbox para incluir igual (marcado por defecto en `false`, sin marcar — el usuario decide, no se asume)
   - Si `fixture === null`: selector manual para elegir el fixture correcto de una lista (`fetchTeamFixtures` ya cargados) o botón "Descartar esta fila"
3. Botón **"Guardar N partidos"** — hace upsert a `coach_match_team_stats` (`onConflict: 'coach_key,fixture_id'`, mismo patrón que `upsertMatchNote`) de todas las filas que tengan fixture asignado y no estén descartadas (incluidas las amarillas si el usuario las dejó marcadas).

Nueva función en `src/services/coachService.ts`: `upsertCoachMatchTeamStats(coachKey: string, fixtureId: number, stats: { possessionPct, xgFor, xgAgainst, rawMetrics, sourceFile }): Promise<{success, error?}>` y `listCoachMatchTeamStats(coachKey: string): Promise<CoachMatchTeamStats[]>`, mismo estilo que las funciones ya existentes de notas/entrenamientos.

## 5. Cartel de "falta cargar"

En `CoachSummaryTab.tsx` (o el nuevo card de estadísticas, sección 6): comparar `fixtures` finalizados (`isMatchFinished`, ya se usa) contra los `fixture_id` presentes en `listCoachMatchTeamStats(coach.key)`. Si hay 1 o más finalizados sin stats cargadas, mostrar un banner rojo: *"Faltan cargar N partidos — subí el Excel de Wyscout actualizado"* con un botón que abre el panel de carga (sección 4). No se dispara nada automático (no hay forma de saber si el usuario ya tiene el Excel a mano), es solo un aviso visual.

## 6. Card de estadísticas de temporada

Nuevo componente `src/features/coaches/components/CoachSeasonStatsCard.tsx`, agregado en `CoachSummaryTab.tsx` arriba de "Próximo partido". Combina `fetchTeamFixtures(coach.apiTeamId)` (ya disponible) con `listCoachMatchTeamStats(coach.key)`: **el conjunto de partidos que cuentan es la intersección** — solo fixtures que tienen una fila en `coach_match_team_stats` (esa es la definición operativa de "partidos que dirigió", ya verificados o aceptados en la revisión de carga). Con eso se calculan client-side:

- PJ, PG, PE, PP (comparando `goalsHome`/`goalsAway` del fixture según `isHome`, mismo criterio que `matchOutcome` del sub-proyecto 1 — se reusa esa función)
- Puntos sobre posibles (`PG*3 + PE` sobre `PJ*3`)
- GF, GC (suma de goles propios/rivales de esos fixtures)
- Posesión promedio (`possession_pct` promedio de las filas)
- xG a favor / en contra (promedio de `xg_for`/`xg_against`)

Layout: grid de 2 columnas en mobile / 4 en desktop, mismo lenguaje visual que el resto de la sección (`bg-white dark:bg-apple-gray-800/60 rounded-apple-lg`, valores grandes en `text-apple-gray-800 dark:text-white`, label chico arriba en `text-2xs uppercase text-apple-gray-400`). Si `coach_match_team_stats` está vacía todavía (nunca se cargó nada), el card muestra un estado vacío invitando a cargar el primer Excel en vez de un grid de ceros.

## Fuera de alcance

Edición fila-por-fila de `raw_metrics` desde la UI (se guarda para uso futuro, no se muestra todavía). Tolerancia de fecha en el matcheo automático (queda para resolución manual). Historial de versiones si se re-sube el mismo partido (el upsert simplemente pisa el valor anterior — es el comportamiento esperado, corrige datos cargados mal).

## Testing

Mismo criterio que el sub-proyecto 1: solo lógica pura en `.test.ts`.

- `parseWyscoutTeamStats.test.ts`: forward-fill de headers agrupados, separación de fila propia/rival por nombre normalizado, manejo de un par de filas sin ningún equipo propio (fila descartada, no crashea).
- `matchFixtures.test.ts`: `matchFixtureForRow` con fecha+rival exacto (match), fecha correcta pero rival no matchea (sin match), sin ningún fixture con esa fecha (sin match). `verifyCoachForFixture` se testea mockeando `fetchFixtureLineups` (ya hay precedente de mockear funciones de `footballApiService` en tests existentes del proyecto — confirmar el patrón exacto al implementar).
- Cálculo de estadísticas de temporada (PJ/PG/PE/PP, puntos, promedios): función pura extraída (no inline en el componente) para poder testearla — `computeSeasonStats(fixtures, statsRows): SeasonStats`.

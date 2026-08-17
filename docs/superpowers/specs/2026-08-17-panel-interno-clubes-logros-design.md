# Panel Interno: Clubes y Copas + Logros

**Fecha:** 2026-08-17
**Estado:** Aprobado para plan de implementación

## Contexto

Panel Interno (`src/pages/DashboardPage.tsx`, ruta debajo de "Inicio" en el menú) es el
dashboard a nivel agencia de Doble G Sports Group: KPIs de portfolio, Score GG por
posición, evolución de valor, contratos por vencer, top rendimiento, análisis de ligas,
etc. Es un scroll único de secciones (componente `Section`), sin pestañas.

El usuario pidió que esta página se sienta más como un simulador de manager de fútbol,
sin perder el estilo visual actual (paleta "Apple dark": `brand-green`, `apple-gray`,
`card-apple`, sin emojis, iconografía SVG limpia). Dos features nuevas, ambas a nivel
agencia (no por ficha de jugador individual):

1. **Clubes y Copas** — elegir el equipo de un jugador del roster interno y ver cómo le
   va: tabla de posiciones de su liga, y progreso en las copas (nacional/internacional)
   en las que esté metido.
2. **Logros** — vitrina de títulos ganados por jugadores mientras representaban a Doble G
   (cargados manualmente por el usuario vía chat), con un desglose evolutivo por año para
   sacar conclusiones a nivel agencia ("cuántos campeones en 2023, cuántos en 2024...").

Ambas van como secciones nuevas al final del scroll de `DashboardPage.tsx` (opción
elegida sobre convertir la página en pestañas).

## Fuera de alcance

- Ficha individual de jugador: sin cambios. Esto es exclusivamente Panel Interno.
- Sync automático de nuevas ligas (ej. Indonesia Liga 1, id 274 en API-Football, todavía
  no está en la tabla `leagues` de Supabase) — la sección Clubes y Copas no depende de
  eso porque consulta API-Football en vivo, no la tabla `player_match_stats`.
- Carga de logros vía formulario en la app — se decidió que el usuario se los dicta a
  Claude por chat y quedan versionados en git (mismo patrón que `agencyPlayers.ts` /
  `agencyCoaches.ts`).
- Actualización automática/cron de valor de mercado — ya existe
  (`supabase/functions/enrich-player`, cron semanal domingos 3am UTC). El usuario pidió
  que se actualice "de vez en cuando" bajo pedido; alcanza con invocar esa función
  existente en modo `single`/`refresh` cuando lo pida, no hace falta código nuevo.

## Clubes y Copas

### Resolución de competencias (sin curación manual)

API-Football tiene `GET /leagues?team={id}`, que devuelve todas las competencias
(ligas y copas) en las que un equipo está registrado, con la temporada vigente marcada
(`seasons[].current === true`) y si esa temporada tiene tabla de posiciones
(`seasons[].coverage.standings`). Verificado en vivo contra Bhayangkara FC (team 2443):
devuelve Liga 1 Indonesia (id 274, `type: "League"`, standings sí) y copas locales
(`type: "Cup"`, standings no). Esto reemplaza cualquier necesidad de mantener a mano
`leagueApiId`/`cupApiId` por jugador (a diferencia de `AgencyCoach`, que sí lo tiene
hardcodeado) — se resuelve 100% en runtime a partir del `apiTeamId` que ya existe en
`AgencyPlayer`.

Nueva función en `src/services/footballApiService.ts`:

```ts
export interface TeamCompetition {
  leagueId: number
  leagueName: string
  leagueLogo: string
  type: 'League' | 'Cup'
  season: number
  hasStandings: boolean
  country: string
}

export async function fetchTeamCompetitions(teamId: number): Promise<TeamCompetition[]>
```

Cachea en localStorage 24h (`dg-team-competitions-cache`, las competencias vigentes de
un equipo no cambian de un día para el otro).

Para copas sin tabla (`hasStandings: false`), otra función nueva reutiliza el patrón de
`fetchSeasonFixtures` pero filtrando por liga:

```ts
export async function fetchTeamCompetitionFixtures(
  teamId: number, leagueId: number, season: number
): Promise<AgencyFixture[]>
```

### Componentes

- **`src/components/shared/StandingsTable.tsx`** (nuevo, extraído de
  `CoachLeagueTab.tsx` líneas 74-188, que pasa a consumirlo): tabla de posiciones pura
  — recibe `groups: StandingRow[][]`, `activeGroup`, `highlightTeamId`, `sortKey` y sus
  setters. Sin fetching propio. Evita duplicar el JSX de la tabla entre Entrenadores y
  Panel Interno.
- **`src/components/dashboard/ClubsAndCupsSection.tsx`** (nuevo):
  - Selector de equipo: dropdown con los equipos únicos del roster interno (agrupa
    `AGENCY_PLAYERS` por `apiTeamId`, descarta jugadores sin `apiTeamId`, muestra nombre
    de equipo + miniaturas de los jugadores de ese equipo).
  - Al elegir un equipo, `fetchTeamCompetitions(teamId)` y arma una pestaña por
    competencia (liga primero, copas después, orden por `type`).
  - Pestaña con `hasStandings: true` → `StandingsTable` (mismo `fetchLeagueStandings`
    que ya existe), con el equipo elegido resaltado.
  - Pestaña con `hasStandings: false` → lista compacta de últimos resultados / próximo
    partido de esa competencia (`fetchTeamCompetitionFixtures`), sin tabla.
  - Estilo: `Section` component existente de `DashboardPage.tsx`, tabs con la misma
    clase que `CoachLeagueTab` (`bg-brand-green` activa / `bg-apple-gray-100` inactiva),
    sin emojis, iconos SVG line-art si hace falta un ícono de sección (mismo patrón que
    el gradiente `from-blue-500 to-purple-600` de "Análisis de Ligas y Oportunidades").

## Logros

### Datos

Nuevo archivo `src/constants/agencyAchievements.ts`, poblado a mano por Claude cuando el
usuario dicte un título por chat (nombre, torneo, tipo, año, club):

```ts
export type AchievementType = 'liga' | 'copa' | 'copa_liga' | 'continental' | 'otro'

export interface AgencyAchievement {
  playerName: string        // fullName, matcheado contra AgencyPlayer.fullName
  type: AchievementType
  competition: string       // ej. "Liga Profesional Argentina"
  club: string               // club con el que lo ganó
  year: number                // temporada, para el gráfico evolutivo
  dateLabel?: string          // ej. "Apertura 2025", opcional
}

export const AGENCY_ACHIEVEMENTS: AgencyAchievement[] = []
```

Matching de `playerName` contra el roster reutiliza `normalizeName` (`src/utils/scoring.ts`,
ya usado en `DashboardPage.tsx`) para tolerar acentos/mayúsculas, mismo criterio que el
resto de la app.

### Imágenes de trofeo

PNG generados por IA (render 3D, cromo oscuro + verde esmeralda, fondo transparente,
sombra suave — estilo aprobado por el usuario), uno por `AchievementType`, guardados como
assets estáticos en `public/trophies/{liga,copa,copa_liga,continental,otro}.png`. Al
momento de este spec están generados `liga`, `copa`, `continental` y `otro`; falta
`copa_liga` (se cortaron los créditos de generación a mitad de lote) — se genera en
cuanto haya créditos disponibles; hasta entonces esa categoría usa el ícono de `copa`
como placeholder.

### Componente

**`src/components/dashboard/AchievementsSection.tsx`** (nuevo):

- **Gráfico evolutivo** (arriba): título por año, línea por `AchievementType` (Recharts
  `LineChart`, mismo look que `PortfolioValueChart`/`MarketValueChart` — paleta
  `brand-green` para el total, colores secundarios apple-gray para desglose, sin
  gradientes gaudy). Toggle de series por leyenda (Recharts nativo). Permite responder
  "cuántos salimos campeones en 2023 vs 2024, de qué tipo".
- **Filtros**: por año y por tipo (chips, mismo patrón visual que los toggles de
  `CoachLeagueTab`).
- **Galería**: grid de tarjetas — imagen de trofeo (`public/trophies/*.png`), nombre del
  jugador (con link a su ficha, `navigate('/jugador/...')` como el resto del dashboard),
  competencia, club, año.
- **Estado vacío**: mientras `AGENCY_ACHIEVEMENTS` esté vacío, mensaje simple invitando a
  cargar el primer logro (sin blanco muerto).

## Testing

- `StandingsTable`: `CoachLeagueTab.tsx` no tiene test propio hoy; al extraer el
  componente, agregar un test mínimo de ordenamiento (por puntos/GF/GC) y de resaltado
  del equipo activo, cubriendo tanto el consumidor de Entrenadores como el de Clubes y
  Copas.
- `fetchTeamCompetitions` / `fetchTeamCompetitionFixtures`: test con fixture JSON mockeado
  (mismo patrón que `src/services/__fixtures__/primera-nacional-standings-2026-08-08.json`).
- `AchievementsSection`: test del cálculo de conteo por año/tipo para el gráfico
  evolutivo (función pura, separable del componente).

## Nota operativa (fuera del código)

La liga de Uruguay (donde jugaba Vera antes de este cambio) lleva sin sincronizar desde
2026-05-22, y la Indonesia Super League nunca estuvo en la tabla `leagues`. Ninguna de
las dos bloquea esta feature (que lee API-Football en vivo), pero quedan pendientes de
resync/alta para que el pipeline de partidos (`sync-fixtures` → `sync-player-stats` →
`recalc-scores`) vuelva a ser la fuente de verdad del club actual sin intervención manual.

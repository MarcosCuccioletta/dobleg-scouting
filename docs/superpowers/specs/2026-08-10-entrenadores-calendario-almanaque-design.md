# Entrenadores — Calendario en vista mensual tipo almanaque

## Contexto

Cuarto sub-proyecto de la tanda de 8 sobre Entrenadores (ver `docs/superpowers/specs/2026-08-08-entrenadores-domingo-stillitano-design.md` para la lista completa). Cubre el pedido: convertir el tab **Calendario** de la ficha de un entrenador en una vista mensual tipo almanaque, en vez de la lista de agenda actual.

Hoy `CoachCalendarTab.tsx` muestra una lista vertical de 14 días (hoy + próximos 13) con "pastillas" por día (partido con escudo+resultado, entrenamiento con ícono de rayo+título, avioncito si el partido es en el exterior), armada con `mergeCalendarEvents(fixtures, sessions)` de `src/utils/coachCalendar.ts` sobre `fetchTeamFixtures(coach.apiTeamId)` (ventana rodante, últimos+próximos partidos) y `listTrainingSessions(coach.key)` (todos los entrenamientos del entrenador).

Confirmado con el usuario: al tocar un día con partido, se abre un panel debajo del calendario con el detalle de ese día (no navega directo a la página de partido) — desde ese panel, si el partido ya se jugó, hay un link al detalle completo.

## 1. Fuente de datos: pasar a temporada completa

`fetchTeamFixtures` trae una ventana rodante (no sirve para navegar a meses ya jugados). Se reemplaza por `fetchSeasonFixtures(coach.apiTeamId, coach.leagueSeason)` (`src/services/footballApiService.ts`, ya existe y ya se usa en el sub-proyecto de Estadísticas de Wyscout) — trae toda la temporada, pasado y futuro, en un solo pedido cacheado. Si `coach.leagueSeason` no está definido (dato faltante en `constants/agencyCoaches.ts`), el tab muestra el mismo `EmptyState` que ya usa hoy cuando falta `coach.apiTeamId`.

`listTrainingSessions(coach.key)` no cambia — ya trae todos los entrenamientos del entrenador sin ventana de fecha, se filtran por mes en el cliente.

`mergeCalendarEvents` (`src/utils/coachCalendar.ts`) no cambia — sigue siendo la función que combina fixtures + sesiones en un `Map<fecha, CoachCalendarDay>`.

## 2. Grilla del mes — lógica pura testeada

Nuevo módulo `src/features/coaches/calendarMonthGrid.ts`:

```ts
export interface MonthGridCell {
  date: string          // ArDateKey 'YYYY-MM-DD'
  dayNumber: number
  isCurrentMonth: boolean
}

export function buildMonthGrid(year: number, month: number): MonthGridCell[][]
export function pickDefaultSelectedDate(
  grid: MonthGridCell[][],
  todayKey: string,
  eventsByDate: Map<string, CoachCalendarDay>,
): string
```

`buildMonthGrid`: arma las semanas (filas de 7 días, Lunes a Domingo) que cubren el mes `month` (0-indexado, como `Date`) del año `year`, completando con los últimos días del mes anterior y los primeros del mes siguiente hasta llenar semanas completas (igual que cualquier calendario tipo almanaque). `isCurrentMonth` marca si ese día pertenece al mes visible o es relleno de un mes vecino.

`pickDefaultSelectedDate`: si `todayKey` cae dentro del mes visible, se selecciona ese día. Si no (el usuario navegó a otro mes), se selecciona el primer día del mes visible que tenga eventos en `eventsByDate`; si ninguno tiene eventos, se selecciona el día 1 del mes visible.

## 3. `CoachCalendarTab.tsx` — reescritura

Estado nuevo: `visibleMonth` (`{ year: number; month: number }`, arranca en el mes de hoy), `selectedDate` (ArDateKey, arranca según `pickDefaultSelectedDate`). Al cambiar de mes (flecha prev/next, botón "Hoy", o tocar un día atenuado de mes vecino) se recalcula `selectedDate` con `pickDefaultSelectedDate` para el nuevo mes visible.

**Encabezado:** mes + año en español (`parsed.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })`, capitalizado), flecha izquierda/derecha para mes anterior/siguiente, botón "Hoy" (deshabilitado/oculto si `visibleMonth` ya es el mes actual) que vuelve al mes de hoy y selecciona el día de hoy.

**Grilla:** 7 columnas con encabezado de días (L M M J V S D), una fila por semana de `buildMonthGrid`. Cada celda:
- Días de mes vecino (`isCurrentMonth: false`): número atenuado (`text-apple-gray-300 dark:text-apple-gray-600`), sin puntos de evento aunque los tenga (no se calculan para vecinos, simplifica y evita ruido visual) — clickeable, cambia `visibleMonth` al mes de ese día y lo selecciona.
- Días del mes visible: número normal; si es hoy, mismo tratamiento visual que ya existe hoy (círculo/fondo `bg-brand-green/10` o similar, número en `text-brand-green`); si es el día seleccionado, fondo sólido distinto (`bg-brand-green` con texto claro, o un borde marcado) para diferenciarlo de "hoy" cuando son días distintos.
- Debajo del número, hasta 2 puntitos pequeños: uno verde si `day.fixtures.length > 0`, uno gris si `day.sessions.length > 0`. Ícono de avión chico (reutilizar `PlaneIcon` ya existente) en vez del puntito verde si `day.isAbroad` es true, para no perder esa señal.
- Celda completa clickeable (`button`), togglea `selectedDate` a ese día (dentro del mes visible).

**Panel de detalle debajo de la grilla:** para `selectedDate`, buscar el `CoachCalendarDay` correspondiente en el `Map` de `mergeCalendarEvents` (o un día vacío `{fixtures: [], sessions: [], isAbroad: false}` si no hay entrada). Reusa el layout de fila que ya existe hoy en la lista (chip de fecha a la izquierda + pastillas a la derecha), pero ahora solo para un día en vez de 14 filas. Las pastillas de partido, entrenamiento y el avioncito son exactamente las que ya están implementadas — se mueven tal cual, sin rediseño visual. **Diferencia nueva:** si el partido está finalizado (`isMatchFinished(f.statusShort)`, ya existe), la pastilla se envuelve en un `Link` a `/entrenadores/${coach.key}/partido/${f.fixtureId}` (mismo patrón exacto que ya usa `CoachSummaryTab.tsx:141`); si no está finalizado, queda igual que hoy (sin link, informativa). Si el día no tiene fixtures ni sesiones, mensaje "Sin actividad este día" en vez de la fila vacía actual.

## Fuera de alcance

Límites de navegación de mes (no se restringe a los meses con datos reales de la temporada — navegar a un mes sin partidos ni entrenamientos simplemente muestra una grilla sin puntos, no hace falta bloquear nada). Selección múltiple de días o vista de "semana". Edición de entrenamientos desde el panel de detalle del almanaque (ya existe en el tab Entrenamientos, sub-proyecto #5, no se duplica acá).

## Testing

- `calendarMonthGrid.test.ts`: `buildMonthGrid` arma semanas completas (múltiplo de 7), marca correctamente `isCurrentMonth` para relleno de mes anterior/siguiente, cubre un mes que empieza en domingo y uno que empieza en lunes (casos borde de relleno), y diciembre/enero (cruce de año). `pickDefaultSelectedDate`: hoy dentro del mes visible se auto-selecciona; mes visible distinto al de hoy sin eventos selecciona el día 1; mes visible distinto con eventos selecciona el primer día con evento.

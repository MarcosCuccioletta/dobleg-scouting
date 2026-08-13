# Entrenadores: ficha de entrenador sin club — Implementation Design

## Contexto

La sección Entrenadores soporta hoy dos casos: `activo` (tiene equipo, ej. Nicolás Domingo en Temperley) y `sin_club` (ej. Leandro Stillitano). Para `sin_club`, `CoachDetailPage.tsx` (líneas 103-121) corta todo el render y muestra una tarjeta vacía con foto, nombre y un texto genérico — ninguna pestaña se muestra.

Revisando el código de las pestañas existentes, la mayoría ya está escrita de forma defensiva ante `apiTeamId: null`:

- `CoachTrainingTab.tsx` (Entrenamientos): al no haber `apiTeamId`, el `useEffect` que trae fixtures del equipo simplemente hace `setFixtures([])` (línea 47-50) en vez de bloquear. La bitácora semanal, el panel de carga por día y el historial dependen únicamente de `coach.key` vía `coachService.ts` (tabla `coach_training_sessions`), no del equipo. Sin equipo solo se pierde el puntito de "hay partido" en la grilla — no hay bloqueo ni crash.
- `CoachTacticalBoardTab.tsx` (Pizarra): el prefill automático con el 11 real está guardado detrás de `if (!coach.apiTeamId) return` antes de llamar a `fetchSquadCached`. Sin equipo, la pizarra se abre en blanco con fichas genéricas — funciona igual, solo sin auto-relleno.
- `CoachSummaryTab.tsx` (Resumen) y `CoachNotesTab.tsx` (Notas) sí cortan con un `EmptyState` cuando falta `apiTeamId`, porque dependen de partidos reales del equipo (`fetchTeamFixtures`, notas atadas a `fixture_id`).
- `TeamRosterPanel` (Plantel), `CoachLeagueTab` (Liga), `CoachCalendarTab` (Calendario) y `CoachFutureSquadTab` (Plantel futuro) requieren plantel/calendario/liga real — no tiene sentido mostrarlos sin equipo.

Decisión de alcance (confirmada con el usuario): Notas de partido queda oculta para entrenadores sin club (no se arma un sistema de partidos manuales/amistosos). El resto de las pestañas que ya toleran `apiTeamId: null` (Entrenamientos, Pizarra) sí deben mostrarse. Resumen se reemplaza por un panel de bio + trayectoria nuevo.

## Cambio 1 — `CoachDetailPage.tsx`: sacar el bloqueo total

Eliminar el bloque de retorno anticipado para `coach.status === 'sin_club'` (líneas 103-121). En su lugar, la página sigue el mismo flujo de render que un entrenador activo, con dos diferencias:

- **Header:** en vez de mostrar `coach.club`, muestra "Sin club actualmente" (mismo texto y estilo — punto gris en vez de verde — que ya existía en la tarjeta vacía).
- **Barra de pestañas:** la lista de tabs se arma dinámicamente según los datos del entrenador. Para `sin_club`, solo aparecen `Resumen`, `Entrenamientos`, `Pizarra`. Las pestañas que requieren equipo real (`Plantel`, `Liga`, `Calendario`, `Notas`, `Plantel futuro`, `Reserva`) no se muestran — hoy la condición de renderizado de cada pestaña ya depende de `coach.apiTeamId`/`coach.leagueApiId`/`coach.reserveApiTeamId`, pero hay que aplicar el mismo filtro a la lista `TABS` que arma los botones (hoy la fila de botones no filtra, solo el contenido).

`activeTab` sigue viviendo en el query param `?tab=`, sin cambios en esa mecánica.

## Cambio 2 — Panel de bio + trayectoria (`CoachBioTab`, nuevo)

Nuevo componente `src/features/coaches/components/CoachBioTab.tsx`, montado en `CoachDetailPage` en lugar de `CoachSummaryTab` cuando `!coach.apiTeamId`:

```
{activeTab === 'resumen' && (
  coach.apiTeamId ? <CoachSummaryTab coach={coach} /> : <CoachBioTab coach={coach} />
)}
```

Contenido:
- Datos personales: edad, nacionalidad, lugar de nacimiento (de `birth.place`/`birth.country` de la API).
- Trayectoria: lista de clubes dirigidos con fecha de inicio y fin (`career`), ordenada del más reciente al más antiguo. Cada fila muestra escudo, nombre del club y rango de fechas (fin abierto = "Actualidad", aunque para un `sin_club` no debería aparecer salvo que la API tenga datos desactualizados — se muestra igual, es un dato de la API, no se filtra).
- Si la búsqueda no encuentra coincidencia en la API: mensaje simple tipo `EmptyState` ya usado en el resto de la sección ("No encontramos el perfil de este entrenador en la base de datos").
- Mientras carga: mismo patrón `LoadingSpinner` que el resto de las pestañas.

## Cambio 3 — `footballApiService.ts`: `fetchCoachProfile`

Nueva función siguiendo el mismo patrón que el resto del archivo (proxy `/api/football`, caché en `localStorage`):

```ts
export interface CoachCareerEntry {
  teamId: number
  teamName: string
  teamLogo: string
  start: string | null
  end: string | null
}

export interface CoachProfile {
  age: number | null
  nationality: string | null
  birthPlace: string | null
  birthCountry: string | null
  career: CoachCareerEntry[]
}

export async function fetchCoachProfile(fullName: string, apiId?: number | null): Promise<CoachProfile | null>
```

- Si `apiId` está seteado, llama a `/coachs?id=`. Si no, llama a `/coachs?search=<fullName>` y toma el primer resultado de `response`.
- Caché en `localStorage` por `coach.key` (no por nombre, para no romper si el nombre visible cambia), TTL 24h (`CACHE_TTL_COACH_PROFILE`), mismo mecanismo `getCachedGeneric`/`setCacheGeneric` ya existente en el archivo.
- Si la respuesta viene vacía o la llamada falla, devuelve `null` (el componente lo traduce al mensaje de "no encontramos el perfil").
- Mapeo de la respuesta cruda de la API (`career: [{team, start, end}]`) a `CoachCareerEntry[]` ordenado por `start` descendente: función pura exportada por separado para poder testearla sin mockear `fetch` (mismo criterio que `seasonStats.ts` / `trainingInsights.ts`).

## Cambio 4 — `agencyCoaches.ts`: campo opcional `coachApiId`

Se agrega `coachApiId?: number | null` a la interfaz `AgencyCoach`, sin valor para ningún entrenador por ahora. Se usa solo si la búsqueda por nombre de Stillitano (u otro futuro entrenador sin club) resuelve mal por ambigüedad de nombre — se detecta en la verificación visual y, si hace falta, se completa a mano.

## Fuera de alcance

- Notas de partido para entrenadores sin club (decisión explícita: se mantiene oculta).
- Cualquier flujo de partidos manuales/amistosos.
- Cambios en Plantel, Liga, Calendario, Plantel futuro — siguen requiriendo equipo real y no se muestran para `sin_club`.

## Testing y verificación

- Unit test para la función pura de mapeo de `career` (casos: club actual sin `end`, varios clubes, respuesta vacía).
- `tsc --noEmit` y suite completa en verde.
- Verificación visual en Chrome con Stillitano: Resumen muestra bio real (o el mensaje de "no encontramos perfil" si la búsqueda no matchea), Entrenamientos y Pizarra funcionan igual que para un entrenador activo, y Plantel/Liga/Calendario/Notas/Plantel futuro no aparecen en la barra de pestañas.

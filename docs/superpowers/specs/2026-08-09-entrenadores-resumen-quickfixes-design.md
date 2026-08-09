# Entrenadores — Resumen: racha, 10 resultados, detalle de partido, rival y navegación

## Contexto

Primer sub-proyecto de una tanda de 8 pedidos sobre la sección Entrenadores (feedback del usuario tras probar la rama `worktree-feat+entrenadores-domingo-stillitano` en local). Este cubre solo el tab **Resumen** de `CoachSummaryTab.tsx`. Los otros 7 (stats Wyscout, Plantel por posición, Calendario mensual, Entrenamientos, Notas por fase, Pizarra táctica, Armado de plantel futuro) son sub-proyectos separados, con su propio spec/plan cuando se llegue a ellos.

Verificado en vivo contra API-Football (fixture 1498702, Temperley vs Gimnasia y Tiro) antes de diseñar:
- `/fixtures/lineups?fixture=X` → **sí** trae `coach.name` (confirmado "Nicolas Domingo") y `startXI`/`substitutes` por equipo. `formation` y `grid` vienen `null` para esta liga — no hay forma de dibujar la cancha con posiciones exactas, solo listar jugadores.
- `/fixtures/events?fixture=X` → sí trae goles/tarjetas/cambios con minuto.
- `/fixtures/statistics?fixture=X` → vacío (`results: 0`) para Primera Nacional. No hay posesión/tiros/xG por esta vía — coherente con la decisión ya tomada de usar el Excel de Wyscout para esas métricas (sub-proyecto 2, aparte).
- No existe ninguna fuente de "momentum" (gráfico de dominio del partido minuto a minuto) integrada ni disponible en API-Football. **Queda fuera de este alcance**; si en el futuro se consigue otra fuente se agrega como mejora aparte.

`getTeamFixtures` en `footballApiService.ts` ya pide `/fixtures?team=X&last=10` (10, no 5) — el límite de 5 está solo en el `.slice(0, 5)` de `CoachSummaryTab.tsx`. Como es un pedido por equipo (no por liga), Copa Argentina u otro certamen ya vienen incluidos si el fixture existe en API-Football para ese equipo.

## 1. Racha (10 resultados, más viejo → más nuevo)

Tira compacta arriba de la lista de resultados (no arriba de "Próximo partido"). Un componente nuevo `CoachStreakStrip.tsx` en `src/features/coaches/components/`, recibe `fixtures: AgencyFixture[]` ya ordenados:

```ts
const lastTen = [...fixtures]
  .filter(f => isMatchFinished(f.statusShort))
  .sort((a, b) => a.timestamp - b.timestamp)   // ascendente: más viejo primero
  .slice(-10)
```

Cada resultado: un badge chico de 20-24px con la letra (G/E/P) y el color de `RESULT_STYLES` que ya existe en `CoachSummaryTab.tsx` (se reusa, no se duplica — se mueve a un módulo compartido `src/features/coaches/matchResult.ts` junto con `matchOutcome()`, porque la página de detalle de partido del punto 3 también lo va a necesitar). Sin escudo de rival ni fecha debajo (el pedido dice "solamente las G, E o P con color" — a diferencia del ejemplo de futbolscan.com que sí tiene escudos, acá va más minimalista a propósito porque el espacio es chico y ya hay una lista debajo con el detalle). Si hay menos de 10 partidos jugados, se muestra la racha parcial disponible sin rellenar huecos.

## 2. Últimos 10 resultados

Cambiar `lastFive` → `lastTen` en `CoachSummaryTab.tsx`, `.slice(0, 5)` → `.slice(0, 10)`, label "Últimos 5 resultados" → "Últimos 10 resultados". Se mantiene el orden actual (más nuevo arriba). Sin cambios de layout más allá del texto y el límite.

## 3. Partido → página de detalle

Nueva ruta `/entrenadores/:coachKey/partido/:fixtureId`, componente `CoachMatchDetailPage.tsx` en `src/pages/`. Cada fila de "Últimos 10 resultados" pasa de `<div>` a `<Link to={...}>` conservando el mismo estilo visual (hover sutil nuevo para indicar que es clickeable).

Contenido de la página:
- Header: escudos, marcador, fecha, competencia, venue (mismo patrón visual que la card de "Próximo partido" que ya existe).
- **Alineaciones**: dos columnas (local/visitante), `startXI` + `substitutes` de `/fixtures/lineups`. Como no hay `grid`/`formation` utilizable, se listan agrupados por posición usando el mismo mapeo de posiciones del club (`ARQ`/`LD`/`CB`/`LI`/`VC`/`VI`/`EXT`/`DEL`) que ya usa `FormationPage.tsx` — heurística simple sobre el campo `pos` de cada jugador de la alineación (G/D/M/F que devuelve API-Football) mapeado a esas 8 categorías, sin pretender precisión de grid.
- **Goles y hechos**: timeline de `/fixtures/events` (goles con asistencia, tarjetas, cambios), ordenado por minuto.
- **Nota del DT**: si existe una fila en `coach_match_notes` para ese `fixture_id` (tabla ya creada en el sub-proyecto anterior), se muestra acá embebida, de solo lectura, con link a "Editar en Notas de partido" que lleva al tab Notas. No se edita desde acá — evita duplicar el formulario de edición en dos lugares antes de que el sub-proyecto 6 (notas por fase) rediseñe esa tab.

Nuevas funciones en `footballApiService.ts`: `fetchFixtureLineups(fixtureId)` y `fetchFixtureEvents(fixtureId)`, cacheadas igual que `fetchTeamFixtures` (mismo TTL de 4h, estos datos no cambian una vez jugado el partido — cache más largo, 7 días, para partidos ya finalizados).

## 4. Botón del rival → mini-análisis en la misma página

No existe hoy en la plataforma una vista de "análisis de equipo rival" (Scouting Externo es de jugadores, no de equipos) — construir una completa es un proyecto en sí mismo. Alcance acotado para esto: reemplazar el botón "Cargar informe del próximo rival" (que hoy manda a `/scouting` en blanco) por un panel desplegable **dentro de la misma card de "Próximo partido"**, sin navegar a otra página:

- Plantel del rival: reusa `TeamRosterPanel` (ya existe, se usa en el tab Plantel) pasándole el `teamId` del rival.
- Racha reciente del rival: reusa el mismo `CoachStreakStrip` del punto 1, pidiendo `fetchTeamFixtures(rivalTeamId)`.

Se abre con un botón "Ver rival" (reemplaza al de "Cargar informe"). Si en el futuro se pide algo más completo (formación probable, jugador a marcar, etc.) se aborda como su propio sub-proyecto.

## 5. Navegación: recordar tab y scroll al volver

Hoy `activeTab` en `CoachDetailPage.tsx` es `useState` local — al navegar a la página de detalle de partido y volver, `CoachDetailPage` se remonta y siempre vuelve a `'resumen'`. Fix: mover `activeTab` a un search param (`useSearchParams`, `?tab=plantel`) en vez de estado local. El botón "volver" del navegador restaura la URL completa (incluido el tab) automáticamente; no hace falta lógica manual de scroll porque el comportamiento nativo del navegador ya restaura la posición de scroll cuando la URL (y por lo tanto el contenido renderizado) es la misma al volver — se rompe hoy únicamente porque el tab se pierde y el contenido cambia. Mismo patrón para cuando se navega desde la racha del rival o desde cualquier otro link nuevo de este sub-proyecto.

## Fuera de alcance (explícito)

Gráfico de momentum, análisis táctico completo del rival, formación con coordenadas exactas en el detalle de partido (no hay dato de grid en la API para esta liga), edición de notas desde la página de detalle de partido.

## Testing

- `matchOutcome()` y el nuevo helper de agrupación de racha: tests unitarios puros (ya hay precedente de tests para `coachCalendar.ts`).
- `CoachStreakStrip`: test de que ordena ascendente y corta en 10.
- Mapeo de posición de alineación (API `pos` G/D/M/F → las 8 categorías del club): tests unitarios, casos borde (`pos: null`).
- `CoachMatchDetailPage`: smoke test de render con fixtures mockeadas (patrón ya usado en los tests existentes de `features/coaches`).

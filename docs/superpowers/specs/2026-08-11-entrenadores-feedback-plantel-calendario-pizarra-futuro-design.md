# Entrenadores: feedback de Plantel, Calendario, Pizarra y Plantel futuro

## Contexto

El usuario probó la sección Entrenadores en vivo (rama sin mergear) y dio feedback directo y enojado sobre 4 pestañas. Investigación empírica en el navegador confirmó los 5 problemas reportados, más una causa raíz concreta para el más grave (Pizarra):

1. **Plantel**: usa cards grandes en grilla (`TeamRosterPanel.tsx`). El usuario ya había pedido una lista antes ("ya te lo había dicho").
2. **Calendario**: los días del mes solo muestran un puntito verde — el escudo del rival existe pero solo aparece en el panel de detalle de abajo, chico, después de hacer click y a veces scrollear.
3. **Notas de partidos**: ✅ ya corregido en un commit separado de esta misma sesión (label "Defensiva"→"Fase defensiva" + placeholders sacados).
4. **Pizarra**: el problema más grave. Confirmado en código: `addGenericMarker`, `addPlayerMarker` y `addBallMarker` en `CoachTacticalBoardTab.tsx` ponen **todas** las fichas nuevas en el mismo punto exacto (`x: 50, y: 50`, el centro de la cancha). Si el usuario clickea varios jugadores seguidos sin arrastrar el anterior, quedan todas apiladas exactamente una arriba de la otra — **parece que no pasó nada**, aunque técnicamente sí se agregaron. Además: no hay pizarra prellenada por defecto (hay que crear una y ponerle nombre antes de ver la cancha), la herramienta "Zona" solo dibuja elipse (sin opción de rectángulo), existe la herramienta "Texto" que el usuario pidió sacar, y el ícono de pelota es un dibujo SVG de líneas finas que a tamaño chico no se reconoce como pelota.
5. **Plantel futuro**: la pestaña "Sugeridos" del selector de jugador muestra el ranking global de Score GG sin ningún filtro (aparece Messi/Inter Miami como sugerencia para Temperley) — no hay forma de acotar por liga, país o valor de mercado. La pestaña "Plantel" del mismo selector no muestra Score GG de cada jugador (solo nombre/posición/dorsal). La sección "Bajas planificadas" no explica qué es ni cómo se usa.

## 1. Plantel: lista en vez de cards

**Dónde:** `src/features/coaches/components/TeamRosterPanel.tsx`.

Reemplazar `RosterPlayerCard` (card vertical grande, foto 64-80px, grid de 2-5 columnas) por `RosterPlayerRow`: fila horizontal completa, mismo criterio visual que las filas de selección ya usadas en `FutureSquadPlayerPicker.tsx`/`CoachTacticalBoardTab.tsx` (`PlayerPickerModal`) — foto circular chica (40px), nombre, dorsal, posición corta, badge de minutos/PJ si existen, todo en una sola línea con hover y separador entre filas. Se mantiene el agrupado por posición (headers "ARQUEROS", "DEFENSORES", etc.) y toda la lógica de `resolveLink`/`handleCreate` sin cambios — es un cambio puramente de presentación del componente `RosterPlayerCard`, no de datos ni de navegación.

```tsx
const ROW_CLASSNAME = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-apple-gray-50 dark:hover:bg-apple-gray-800/60 transition-colors border-b border-apple-gray-100 dark:border-apple-gray-700/40 last:border-b-0'

function RosterPlayerRow({ player, stats, link, creating, onCreateClick }: { ...mismos props que hoy... }) {
  const content = (
    <>
      <div className="relative w-10 h-10 flex-shrink-0">
        {player.photo ? (
          <img src={player.photo} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          <div className="w-full h-full rounded-full flex items-center justify-center font-bold text-xs bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400">
            {initialsOf(player.name)}
          </div>
        )}
        {creating && (
          <div className="absolute inset-0 rounded-full bg-white/70 dark:bg-apple-gray-900/70 flex items-center justify-center">
            <span className="w-3 h-3 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-apple-gray-800 dark:text-white truncate">{player.name}</p>
        <p className="text-2xs text-apple-gray-400">
          {player.position ? POSITION_LABEL[player.position] ?? player.position : '—'}
          {player.number != null && ` · #${player.number}`}
        </p>
      </div>
      {stats && (
        <span className="flex-shrink-0 text-2xs font-medium px-2 py-1 rounded-full bg-brand-green/10 text-brand-green">
          {stats.minutes}' · {stats.matches} PJ
        </span>
      )}
      <svg className="w-4 h-4 flex-shrink-0 text-apple-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </>
  )
  // mismo switch sobre link.kind que hoy (Link a interno/externo/supabase, button para create, div para none),
  // aplicando ROW_CLASSNAME en vez de CARD_CLASSNAME.
}
```

Y en `TeamRosterPanel`, cambiar el contenedor de `grid grid-cols-2 sm:grid-cols-3 ...` a una columna simple (`<div className="divide-y ...">` o el propio `border-b` de cada fila) dentro de una card contenedora (`bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border ...`) para que la sección entera se vea como una lista prolija, no como una tabla pelada.

## 2. Calendario: escudo visible en la grilla, no solo en el detalle

**Dónde:** `src/features/coaches/components/CoachCalendarTab.tsx`, la celda de cada día del mes (líneas ~198-228 actuales).

Hoy, un día con partido muestra un puntito verde (o el ícono de avión si es afuera). Se reemplaza por el escudo real del rival cuando el día tiene un solo partido (el caso normal — un entrenador no juega dos partidos el mismo día):

```tsx
{cell.isCurrentMonth && (hasFixture || hasSession) && (
  <span className="flex items-center gap-0.5">
    {hasFixture && day!.fixtures.length === 1 && (
      isAbroad ? (
        <PlaneIcon className={`w-3 h-3 ${isSelected ? 'text-apple-gray-900' : 'text-brand-green'}`} />
      ) : (
        <img
          src={(day!.fixtures[0].isHome ? day!.fixtures[0].awayTeam : day!.fixtures[0].homeTeam).logo}
          alt=""
          className="w-3.5 h-3.5 object-contain"
        />
      )
    )}
    {hasFixture && day!.fixtures.length > 1 && (
      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-apple-gray-900' : 'bg-brand-green'}`} />
    )}
    {hasSession && (
      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-apple-gray-900/60' : 'bg-apple-gray-400'}`} />
    )}
  </span>
)}
```

(El caso de más de un partido el mismo día es un fallback defensivo poco probable en la práctica — se deja el puntito para no romper el layout de la celda con dos escudos superpuestos.)

El panel de detalle de abajo (que ya muestra el escudo en la píldora, sin cambios ahí) queda igual — el cambio es solo que ahora también se ve identidad visual real en la grilla del mes, sin tener que clickear nada.

## 3. Notas de partidos

✅ Ya resuelto (commit `fb159f2` de esta misma sesión: labels "Fase defensiva"/"Fase ofensiva"/"Fase de transiciones", placeholders vacíos). No requiere tareas nuevas.

## 4. Pizarra: rediseño para que ya se vea armada, sin fichas invisibles apiladas

**Objetivo:** al entrar a la pestaña, si el entrenador no tiene ninguna pizarra guardada todavía, se genera y muestra automáticamente una por defecto con los 11 propios reales (mismo mecanismo de prellenado que ya usa Plantel futuro: último partido jugado vía `fetchSeasonFixtures` + `fetchFixtureLineups`, mapeado a posiciones de la formación) y 11 fichas genéricas de rival en el espejo de esa formación — sin que el usuario tenga que tocar "Nueva" ni escribir un nombre. Sigue pudiendo crear pizarras adicionales con nombre para guardar variantes tácticas específicas, pero la primera vez no arranca vacía.

### 4.1 Prellenado automático

**Dónde:** `src/features/coaches/components/CoachTacticalBoardTab.tsx`.

Reusar `mapLineupToSlots`/`FORMATIONS` (`src/features/coaches/futureSquadPrefill.ts`, `src/constants/formations.ts`, ya extraídos y compartidos por Plantel futuro) para calcular las 11 posiciones propias reales. `FORMATIONS[...].positions` usa `x`/`y` en porcentaje 0-100 — el mismo sistema que ya usa `TacticalBoardPitch` para sus anotaciones y fichas (confirmado en `pointFromEvent`, que devuelve porcentaje 0-100 en ambos ejes). Para el rival: mismas posiciones `x`, `y` reflejado verticalmente (`y: 100 - y`) para que quede del lado opuesto de la cancha, con fichas genéricas (`kind: 'generic', team: 'rival'`) sin buscar el plantel real del rival (dato que no siempre está disponible/confiable).

Al montar el tab, si `boards.length === 0`, en vez de mostrar el estado vacío actual ("Creá una pizarra nueva..."), se llama automáticamente a algo equivalente a `handleCreate()` con un nombre por defecto (ej. `"Titular vs próximo rival"` o simplemente la fecha) y se puebla `markers` con los 22 prellenados antes del primer `render`. El usuario puede renombrarla o crear una nueva en blanco si prefiere (el flujo "Nueva" sigue existiendo para pizarras adicionales, pero named vacías siguen siendo válidas para esos casos — solo la PRIMERA vez, sin ninguna pizarra todavía, se autogenera con contenido en vez de forzar el modal de nombre).

### 4.2 Fichas nuevas no se apilan invisibles

**Dónde:** `CoachTacticalBoardTab.tsx`, funciones `addGenericMarker`/`addPlayerMarker`/`addBallMarker`.

En vez de `x: 50, y: 50` fijo para toda ficha nueva, calcular la próxima posición vacía dentro de la formación del equipo correspondiente (`markerTeam`), ciclando por los slots de `FORMATIONS['4-3-3'].positions` (o la formación que se esté usando) que no tengan ya una ficha cerca. Si ya están las 11 posiciones ocupadas, cae a un offset en cascada (ej. `x: 50 + (count % 5) * 4, y: 50 + Math.floor(count / 5) * 4`) para que nunca dos fichas nuevas caigan exactamente superpuestas — esto por sí solo arregla la sensación de "no se agrega nada": cada click deja una ficha visible y distinguible de las anteriores, aunque no siga una formación exacta en ese caso límite.

### 4.3 Herramienta "Zona": círculo o cuadrado

**Dónde:** `src/features/coaches/components/TacticalBoardToolbar.tsx` (agregar selector), `TacticalBoardPitch.tsx` (dibujar según forma), `src/services/tacticalBoardService.ts` (tipo `BoardAnnotation`, variante `zone` gana un campo `shape: 'circulo' | 'cuadrado'`).

Selector de forma (dos botones pequeños, ícono círculo/cuadrado) visible junto al selector de color cuando `tool === 'zona'`. Al dibujar: `shape === 'circulo'` renderiza la `<ellipse>` que ya existe hoy; `shape === 'cuadrado'` renderiza un `<rect>` con las mismas coordenadas `x1,y1,x2,y2` (esquinas del arrastre, sin necesidad de que sea forzosamente cuadrado — "cuadrado" es el nombre coloquial que usó el usuario para "rectángulo", se implementa como rectángulo libre igual que la elipse es libre, no forzada a círculo perfecto).

### 4.4 Sacar herramienta "Texto"

**Dónde:** `TacticalBoardToolbar.tsx` (sacar del `TOOL_META`), `TacticalBoardPitch.tsx` (sacar el manejo de `tool === 'texto'`, el `textInput`/`textValue`/`commitText`, el input flotante, y el caso `kind === 'text'` del render de anotaciones — puede quedar el tipo `text` en `BoardAnnotation` sin emitirse más, para no romper pizarras viejas que ya tengan anotaciones de texto guardadas, simplemente ya no se podrán crear nuevas).

### 4.5 Pelota: ícono más reconocible

**Dónde:** `TacticalBoardPitch.tsx`, función `BallIcon`.

Simplificar el dibujo SVG a un patrón de pelota clásico más grueso y reconocible a 20-24px (menos líneas finas, pentágono central sólido en vez de líneas delgadas de costura) — no hace falta un ícono nuevo elaborado, alcanza con engrosar trazos y reducir detalle. Mantener el label "+ Pelota" del botón (ya está bien, el problema era el dibujo en la cancha, no el botón).

## 5. Plantel futuro: filtros en Sugeridos + Score GG en Plantel + explicar Bajas planificadas

**Dónde:** `src/features/coaches/components/FutureSquadPlayerPicker.tsx`.

### 5.1 Filtros en "Sugeridos"

Agregar una fila de filtros compacta arriba de la lista de sugeridos: selector de liga (`league_id`, ya soportado por `fetchPlayersList`/`usePlayersList` vía `p_league_id`) y rango de valor de mercado (`min_market_value`/`max_market_value`, también ya soportados). País/nacionalidad no tiene parámetro en el RPC (`fetch_players_list`) — se filtra del lado del cliente sobre el pool ya traído (`suggestionPool.filter(p => !country || p.nationality === country)`), igual que ya se hace hoy con `usedCandidateIds`. Las opciones de liga se sacan de las ligas con `has_player_stats = true` (mismas que ya usa el resto de la plataforma), no hace falta una tabla nueva.

### 5.2 Score GG visible en la pestaña "Plantel"

Hoy esa pestaña solo muestra nombre/posición/dorsal (viene de `SquadPlayer`, dato de API-Football, sin score). Cruzar contra `player_season_scores`/`fetch_players_list` por `apiId` para mostrar el Score GG si el jugador ya tiene una fila (mismo patrón que "Sugeridos" ya usa para mostrar `getScoreColorClass`), y "—" si no tiene score todavía (jugador sin datos suficientes esta temporada).

### 5.3 Explicar "Bajas planificadas"

Agregar una línea de ayuda corta arriba de la lista (ej. "Jugadores que salen del plantel: se agregan automáticamente al dar de baja a alguien desde la cancha, o podés anotar el motivo acá") — texto explicativo mínimo, no rediseño de la mecánica en sí (que ya funciona: dar de baja desde la cancha llena esta lista, cada fila tiene motivo editable).

## Testing

- `TeamRosterPanel`: sin lógica nueva, solo presentación — verificación visual en navegador (no hace falta test unitario nuevo).
- `CoachCalendarTab`: sin lógica nueva — verificación visual.
- Pizarra: `mapLineupToSlots`/`FORMATIONS` ya están testeados (`futureSquadPrefill.test.ts`); el mirror para el rival y el cálculo de "próximo slot vacío" son funciones puras nuevas, candidatas a test unitario si quedan como funciones extraídas (recomendado: extraer a `src/features/coaches/tacticalBoardPrefill.ts` con su propio test, mismo criterio que `futureSquadPrefill.ts`).
- `FutureSquadPlayerPicker`: los filtros nuevos son composición de hooks ya testeados indirectamente vía el resto de la plataforma — verificación visual + probar con un jugador real que sí tenga contraste de liga/valor.

## Alcance explícitamente fuera de esta spec

No se toca el mecanismo de guardado/versionado de pizarras (`tacticalBoardService.ts`), ni la estructura de `coach_tactical_boards` en Supabase — solo el contenido inicial y las herramientas de dibujo. No se agrega la opción de plantel real del rival en Pizarra (fuera de alcance, dato poco confiable para equipos rivales en general).

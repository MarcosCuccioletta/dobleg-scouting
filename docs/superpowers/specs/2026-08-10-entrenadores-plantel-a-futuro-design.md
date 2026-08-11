# Entrenadores — Armado de plantel a futuro

## Contexto

Octavo y último sub-proyecto de la tanda de 8 sobre Entrenadores (ver `docs/superpowers/specs/2026-08-08-entrenadores-domingo-stillitano-design.md` para la lista completa). Pestaña nueva: una herramienta de planificación de plantel a futuro para el DT, estilo `/formacion` pero con dos diferencias clave (confirmadas con el usuario): arranca **precargada con el 11 real del equipo** (no en blanco) y agrega una mecánica explícita de **bajas y altas**. Sin ninguna relación con la agencia Doble G — es una herramienta general de planificación deportiva, el buscador de altas cubre toda la base de scouting.

## 1. Reuso: formaciones compartidas con `/formacion`

`FormationPage.tsx` tiene hoy el set de formaciones (`4-3-3`, `4-4-2`, `4-2-3-1`, `3-5-2`, `5-3-2`, cada una con sus posiciones `{key, x, y}`) y el mapeo `POSITION_KEY_API_MAP` (slot de formación → posiciones `Position[]` del sistema de scoring, ej. `'LB': ['LI']`) como constantes locales, no exportadas. Se extraen a `src/constants/formations.ts` (`FORMATIONS`, `POSITION_KEY_API_MAP`) y `FormationPage.tsx` pasa a importarlas de ahí — evita duplicar el layout de posiciones y el mapeo, y esta pestaña nueva los reusa tal cual.

El buscador de jugadores para las altas reusa `usePlayersList` (mismo hook que ya usa `/formacion`, trae `PlayerWithScore[]` de toda la base de scouting) filtrado por el `Position[]` del slot vacío que se está completando, mismo criterio que ya aplica `/formacion` al buscar candidatos para una posición.

## 2. Prellenado automático con el 11 real

Al abrir la pestaña por primera vez (sin plan guardado todavía para ese entrenador), se busca el último partido jugado vía `fetchSeasonFixtures(coach.apiTeamId, coach.leagueSeason)` (ya usado en Calendario/Estadísticas — trae toda la temporada, se filtra al más reciente con fecha pasada) y se trae su alineación real con `fetchFixtureLineups(fixtureId)` (ya existe, `ApiFixtureLineup[]` con `formation` y `startXI`, hay que quedarse con la entrada cuyo `team.id === coach.apiTeamId`).

- Si el `formation` reportado (ej. `"4-3-3"`) coincide con una clave de `FORMATIONS`, se autoselecciona esa formación.
- Si no coincide con ninguna (formato raro o `null`), se usa `4-3-3` por defecto.
- Los 11 jugadores del `startXI` se ubican en los slots de la formación elegida, en el mismo orden en que la API los devuelve (típicamente arquero → defensores → mediocampistas → delanteros) emparejado contra el orden de slots de `FORMATIONS[formation].positions`. No se intenta un mapeo exacto por columna de `grid` — con el orden alcanza para un punto de partida razonable, y el DT reacomoda arrastrando si hace falta (igual que hoy hace en `/formacion`).
- Si no hay partidos jugados, o `coach.apiTeamId`/`coach.leagueSeason` faltan, o la consulta falla: la cancha arranca vacía con selector en `4-3-3`, mismo criterio que el resto de la sección cuando falta un dato (no es un error, es un estado vacío más).

Este prellenado solo ocurre la primera vez (cuando no hay fila guardada en Supabase todavía para ese `coach_key`). Una vez que el DT guarda, el plan guardado siempre tiene prioridad — no se vuelve a pisar con la alineación real en visitas futuras.

## 3. Cancha: plantel propio + altas, todo en los mismos slots

La cancha reusa el mismo criterio visual y de interacción por drag que `/formacion` (fichas por posición, arrastre libre dentro del contenedor). Cada ficha ocupada indica su origen:

- **Plantel propio** (viene del prellenado o se agregó después): ficha con dorsal + apellido, borde neutro.
- **Alta** (jugador agregado por el DT desde el buscador de scouting): ficha con nombre + Score GG si tiene, borde celeste para distinguirla a simple vista de quién ya está en el plantel real.

Tocar una ficha de plantel propio ofrece dos acciones: mover (arrastre libre, igual que hoy) y **"Dar de baja"**. Tocar una ficha de alta ofrece mover y **"Quitar"** (sin pasar por la lista de bajas — nunca estuvo en el plantel real, no hay "baja" que registrar). Un slot vacío muestra el buscador de altas filtrado por el `Position[]` de ese slot.

## 4. Bajas: lista aparte con motivo

"Dar de baja" saca la ficha de la cancha (el slot queda vacío, listo para una alta) y agrega al jugador a una lista corta debajo de la cancha, **"Bajas planificadas"**: nombre + un campo de texto libre opcional para el motivo (ej. "vence contrato", "se vende", "bajo rendimiento" — sin combos rígidos, mismo criterio que los campos de texto libre ya usados en Notas de partido y Entrenamientos). Cada fila de la lista tiene un botón "Quitar de bajas" para deshacer (no repone al jugador en la cancha automáticamente — si el DT se arrepiente, lo vuelve a agregar a mano en el slot que corresponda, evita tener que reconstruir su posición exacta anterior).

## 5. Datos: tabla nueva `coach_future_squads`, una fila por entrenador

A diferencia de la Pizarra táctica (que permite múltiples pizarras guardadas para distintas jugadas), acá tiene sentido **un solo plan vivo por entrenador** que se edita in-place — no "varios planteles futuros" en paralelo.

```sql
CREATE TABLE IF NOT EXISTS public.coach_future_squads (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_key       TEXT NOT NULL UNIQUE,
  formation_type  TEXT NOT NULL DEFAULT '4-3-3',
  slots           JSONB NOT NULL DEFAULT '[]'::jsonb,
  bajas           JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_coach_future_squads_coach ON public.coach_future_squads(coach_key);

ALTER TABLE public.coach_future_squads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_coach_future_squads" ON public.coach_future_squads;
CREATE POLICY "read_coach_future_squads" ON public.coach_future_squads FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_coach_future_squads" ON public.coach_future_squads;
CREATE POLICY "write_coach_future_squads" ON public.coach_future_squads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

`slots` y `bajas` sin `CHECK` de forma (mismo criterio ya usado en toda la rama — la capa de aplicación valida). `UNIQUE` en `coach_key` porque es un plan único, no una lista — el guardado es siempre un upsert (`ON CONFLICT (coach_key) DO UPDATE`).

Nuevo servicio `src/services/futureSquadService.ts`:

```ts
export type SlotPlayerSource = 'squad' | 'candidate'

export interface FutureSquadSlot {
  slotKey: string                       // clave de FORMATIONS[formation].positions, ej. 'LB'
  source: SlotPlayerSource | null       // null = slot vacio
  playerId: number | string | null      // number = id de API-Football (squad), string = id de scoring (candidate)
  playerName: string | null
  playerNumber: number | null           // solo aplica a source === 'squad'
  ggScore: number | null                // solo aplica a source === 'candidate'
}

export interface FutureSquadBaja {
  id: string           // uuid generado en el cliente
  playerId: number      // id de API-Football
  playerName: string
  reason: string         // texto libre, puede quedar vacio
}

export interface FutureSquadPlan {
  coach_key: string
  formation_type: string
  slots: FutureSquadSlot[]
  bajas: FutureSquadBaja[]
  updated_at: string
}

export async function getFutureSquad(coachKey: string): Promise<FutureSquadPlan | null>
export async function saveFutureSquad(
  coachKey: string,
  formationType: string,
  slots: FutureSquadSlot[],
  bajas: FutureSquadBaja[],
): Promise<{ success: boolean; error?: string }>
```

`getFutureSquad` devuelve `null` cuando no hay fila todavía (dispara el prellenado automático de la sección 2) o si la consulta falla (mismo tratamiento — no es un error visible, es "todavía no hay plan"). `saveFutureSquad` hace upsert por `coach_key`.

## 6. `CoachFutureSquadTab.tsx` — pestaña nueva

Se agrega **"Plantel futuro"** a `CoachDetailPage.tsx` (mismo patrón que las demás tabs: `TABS`, tipo `CoachTab`, `isValidTab`, bloque de render condicional, `key={coach.key}` para remount al cambiar de entrenador). El tab:

1. Selector de formación (mismo set de `FORMATIONS`, cambiarla reacomoda las fichas existentes a los slots más cercanos de la nueva formación — mismo criterio que ya hace `/formacion`).
2. La cancha (fichas de plantel propio + altas, slots vacíos con buscador).
3. Lista "Bajas planificadas" debajo.
4. Botón "Guardar" (manual, sin autoguardado — mismo criterio de toda la rama).

## Fuera de alcance

Deshacer/rehacer. Historial de versiones del plan (guardar sobre-escribe, no hay "plan de la semana pasada"). Cualquier vínculo con la agencia Doble G o con `agencyPlayers.ts` — explícitamente descartado por el usuario. Notificar o exportar el plan (PDF, compartir). Sincronizar automáticamente si el 11 real cambia después del prellenado inicial — el plan guardado es la fuente de verdad una vez que existe.

## Testing

Si el mapeo `startXI` → slots de formación (sección 2) termina siendo una función pura extraíble (recibe la lista de jugadores en orden de la API + la formación elegida, devuelve `FutureSquadSlot[]`), se testea igual que el resto de la lógica pura de la rama (`boardGeometry.test.ts`, `calendarMonthGrid.test.ts` como precedente). El resto (cancha interactiva, buscador, lista de bajas) es UI, se verifica a mano en el navegador antes de dar el sub-proyecto por terminado.

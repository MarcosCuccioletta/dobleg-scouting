# Entrenadores — Plantel por posición con jugadores clickeables

## Contexto

Tercer sub-proyecto de la tanda de 8 sobre Entrenadores (ver `docs/superpowers/specs/2026-08-08-entrenadores-domingo-stillitano-design.md` para la lista completa). Cubre el pedido: en el tab **Plantel** de la ficha de un entrenador, reorganizar por posición y que cada jugador lleve a su ficha.

Hoy `TeamRosterPanel.tsx` ya ordena el plantel (arqueros → defensores → mediocampistas → delanteros) pero como una sola grilla continua sin separadores, y ninguna tarjeta es clickeable.

El plantel viene de `fetchSquadCached(teamId)` (API-Football, `SquadPlayer[]`: id, name, age, number, position genérico en inglés, photo) — son ~25-30 jugadores por equipo, la gran mayoría **no** son de Doble G.

Confirmado con el usuario: todo jugador del plantel tiene que ser clickeable. Si no existe todavía en la base de la app (ni agencia ni Scouting Externo), **se le crea la ficha automáticamente** al clickear — sin diálogo de confirmación — y se navega directo a ella. No hace falta que la ficha nueva venga completa: queda como cualquier jugador scouteado sin cargar del todo, se puede completar después.

### Por qué una tabla nueva en Supabase y no el Google Sheet

`external` (Scouting Externo) se carga una sola vez por sesión desde un Google Sheet publicado como CSV (`loadAllData()` en `csvService.ts`), de solo lectura desde el browser — no hay Apps Script de escritura para ese sheet (a diferencia del flujo de GPS). Escribirle en caliente para que la ficha aparezca de inmediato no es viable con la arquitectura actual, y el CSV ya está marcado como legacy ([[feedback_api_over_csv]]). En cambio, el proyecto ya tiene un patrón idéntico para esto: el overlay de `agencyPlayers` (`agency_overlay` en Supabase + `mergeAgencyIntoInternal` en `DataContext.tsx`) agrega/saca jugadores de `internal` sin tocar el CSV base. Este sub-proyecto reusa el mismo patrón para `external`.

## 1. Tabla nueva en Supabase: `manual_external_players`

```sql
CREATE TABLE IF NOT EXISTS public.manual_external_players (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  api_player_id   BIGINT NOT NULL,
  full_name       TEXT NOT NULL,
  team            TEXT NOT NULL,
  position        TEXT NOT NULL,
  age             INTEGER,
  photo           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_manual_external_players_api_id ON public.manual_external_players(api_player_id);

ALTER TABLE public.manual_external_players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_manual_external_players" ON public.manual_external_players;
CREATE POLICY "read_manual_external_players" ON public.manual_external_players FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_manual_external_players" ON public.manual_external_players;
CREATE POLICY "write_manual_external_players" ON public.manual_external_players
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

`api_player_id` (id de API-Football) es la clave de de-dupe real — evita crear dos fichas si dos entrenadores comparten un rival, o si el usuario clickea dos veces antes de que navegue. `position` guarda el valor genérico ya traducido (ver sección 3), no el código en inglés de la API.

Mismo estilo de RLS que `coach_match_team_stats` / el overlay de agencia: lectura abierta, escritura solo autenticado.

## 2. Service: `src/services/manualExternalPlayersService.ts`

```ts
export interface ManualExternalPlayerRow {
  api_player_id: number
  full_name: string
  team: string
  position: string
  age: number | null
  photo: string | null
}

export async function listManualExternalPlayers(): Promise<ManualExternalPlayerRow[]>
export async function createManualExternalPlayer(row: ManualExternalPlayerRow): Promise<ManualExternalPlayerRow>
```

`createManualExternalPlayer` hace `upsert` por `api_player_id` (`onConflict: 'api_player_id'`) — si dos clicks llegan casi a la vez o el jugador ya fue creado por otro entrenador, no falla ni duplica, devuelve la fila existente.

## 3. Integración en `DataContext.tsx`

Nueva función `manualExternalToEnriched(row: ManualExternalPlayerRow): EnrichedPlayer`, mismo espíritu que `agencyToEnriched` ya existente: llena los campos que sí hay (Jugador, Equipo, Posición, Edad, Imagen) y deja vacíos/0 el resto (Liga, valor de mercado, contrato, stats). `ggScore` sale de `scoreLookup` igual que cualquier otro external (por nombre, no depende del CSV) — si la API de scoring ya conoce a ese jugador por otra vía, aparece con su Score GG real desde el primer momento.

En el efecto de carga de `DataProvider`: después de construir `external` desde el CSV, cargar `listManualExternalPlayers()` en paralelo con `loadAgencyPlayers()`/`fetchAllPlayerVideos()`, convertir cada fila con `manualExternalToEnriched` + scoreLookup, y **agregar solo las que no estén ya presentes** en `external` por nombre normalizado (si el Sheet legacy termina incorporando a ese jugador más adelante, gana la fila del Sheet, no el stub). Guardar el resultado combinado en `externalRef.current` y `data.external` (afecta también a `internal` vía `mergeAgencyIntoInternal`, que ya usa `externalRef.current` como fuente de fallback — sin cambios ahí).

Nueva función expuesta en el contexto: `createManualPlayerAndRefresh(row: ManualExternalPlayerRow): Promise<EnrichedPlayer>` — hace el insert, corre `manualExternalToEnriched`, actualiza `data.external` in place (sin esperar un refetch completo) y devuelve el `EnrichedPlayer` recién creado para que el caller navegue sin depender de un segundo render. Mismo patrón que `refreshAgencyPlayers`, pero devuelve el jugador en vez de solo refrescar.

## 4. Mapeo de posición genérica → Spanish label

`SquadPlayer.position` viene en inglés (`Goalkeeper` / `Defender` / `Midfielder` / `Attacker`, ya usado hoy en `TeamRosterPanel` para `POSITION_LABEL`/`POSITION_ORDER`). Para la ficha nueva se mapea a un valor que el resto de la app entienda (`POSITION_MAP` en `constants/scoring.ts`, usado para filtros y agrupación):

| API-Football | `Posición` guardada |
|---|---|
| Goalkeeper | Arquero |
| Defender | Defensor Central |
| Midfielder | Volante central |
| Attacker | Delantero |

Es una posición genérica, no específica — igual que un jugador recién scouteado sin detalle fino, se puede afinar después a mano si hace falta.

## 5. `TeamRosterPanel.tsx`

- **Agrupado por posición**: en vez de una sola grilla ordenada, 4 secciones (mismo `POSITION_ORDER`/`POSITION_LABEL` ya existentes) cada una con encabezado (`text-sm font-semibold uppercase tracking-wide text-apple-gray-400`, estilo consistente con el resto de la sección) y su propia grilla debajo. Posiciones sin jugadores no muestran sección vacía.
- **Resolución de link por jugador**, usando `useData()` (`external`, `internal`, `agencyPlayers`, `createManualPlayerAndRefresh`):
  - `makeAgencyMatcher(agencyPlayers)(player.name)` → interno: buscar el jugador en `internal` por nombre normalizado y linkear a `/jugador/${encodeURIComponent(match.Jugador)}?source=interno`.
  - si no, buscar en `external` por nombre normalizado → linkear a `/jugador/${encodeURIComponent(match.Jugador)}?source=externo`.
  - si no hay match en ninguno: la tarjeta queda clickeable igual (`onClick`, no `<Link>` directo) — al click dispara `createManualPlayerAndRefresh(...)` con los datos del `SquadPlayer` (mapeando posición según sección 4) y navega con `useNavigate()` a `/jugador/${encodeURIComponent(name)}?source=externo` apenas resuelve. Mientras la creación está en curso, esa tarjeta puntual muestra un spinner pequeño superpuesto (reusar `LoadingSpinner` en tamaño chico o un spinner inline) para que un doble click no dispare dos creaciones — deshabilitar el `onClick` mientras está `creating`.
- El resto de la tarjeta (foto/iniciales, dorsal, nombre, posición, minutos) no cambia.

## Fuera de alcance

Editar o completar a mano los campos vacíos de una ficha creada automáticamente (se hace, si hace falta, con las herramientas que ya existen para cualquier jugador de Scouting Externo — no es parte de este sub-proyecto). Deduplicar fichas manuales retroactivamente si el Sheet legacy después agrega al mismo jugador con otro formato de nombre (mismo riesgo que ya existe hoy con `mergeAgencyIntoInternal`, no es nuevo de este sub-proyecto). Mostrar en la UI qué fichas de Externo fueron creadas automáticamente vs. las que vienen del Sheet (no se pidió, y `EnrichedPlayer` ya trata a todas las de `source: 'externo'` por igual).

## Testing

- `manualExternalToEnriched`: mapea correctamente los campos disponibles y deja el resto en blanco/0, no rompe con `photo`/`age` null.
- Mapeo de posición genérica → `Posición` (sección 4), las 4 posiciones y un valor desconocido (fallback razonable, no debe crashear).
- Agrupado por posición en `TeamRosterPanel`: dado un `squad` con jugadores en varias posiciones, arma las secciones correctas y omite las vacías (test de la función pura de agrupamiento, no del componente completo).

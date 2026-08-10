# Entrenadores — Pizarra táctica

## Contexto

Séptimo sub-proyecto de la tanda de 8 sobre Entrenadores (ver `docs/superpowers/specs/2026-08-08-entrenadores-domingo-stillitano-design.md` para la lista completa). Pestaña nueva: una cancha interactiva donde el DT arma jugadas — fichas arrastrables (propias, rivales, jugadores reales del plantel, la pelota) y herramientas de dibujo (lápiz, flecha, zona sombreada, texto), con pizarras guardadas para retomar después.

Confirmado con el usuario: las fichas de jugador real son obligatorias (no solo genéricas), y el dibujo es la versión completa — varios colores, formas, y texto sobre la cancha, no solo lápiz y flecha.

## 1. Reuso visual: la cancha ya existe

`FormationPage.tsx` (`/formacion`) ya tiene una cancha SVG con las líneas de campo (borde, círculo central, áreas, arcos de esquina) sobre un fondo verde degradado — se reusa el mismo `viewBox="0 0 100 130"` y el mismo dibujo de líneas, para que la pizarra se sienta parte de la misma app. Las fichas de esa pantalla usan posicionamiento absoluto por porcentaje (`left/top: %`) — mismo criterio acá para arrastrar fichas.

## 2. Esquema: tabla nueva `coach_tactical_boards`

```sql
CREATE TABLE IF NOT EXISTS public.coach_tactical_boards (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_key   TEXT NOT NULL,
  name        TEXT NOT NULL,
  markers     JSONB NOT NULL DEFAULT '[]'::jsonb,
  annotations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coach_tactical_boards_coach ON public.coach_tactical_boards(coach_key);

ALTER TABLE public.coach_tactical_boards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_coach_tactical_boards" ON public.coach_tactical_boards;
CREATE POLICY "read_coach_tactical_boards" ON public.coach_tactical_boards FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_coach_tactical_boards" ON public.coach_tactical_boards;
CREATE POLICY "write_coach_tactical_boards" ON public.coach_tactical_boards
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

`markers` y `annotations` van sin `CHECK` de forma (mismo criterio que `raw_metrics`/`focus_tags` de sub-proyectos anteriores — la capa de aplicación valida la forma). Sin `UNIQUE` en `(coach_key, name)` — un DT puede tener varias pizarras con nombres parecidos o repetidos, no es un error.

## 3. Modelo de datos (app)

Nuevo servicio `src/services/tacticalBoardService.ts` (archivo separado de `coachService.ts`, mismo criterio que `formationService.ts` ya separado — es un dominio propio, no una extensión de entrenamientos/notas):

```ts
export type MarkerTeam = 'propio' | 'rival'
export type MarkerKind = 'generic' | 'player' | 'ball'

export interface BoardMarker {
  id: string
  kind: MarkerKind
  team: MarkerTeam | null   // null solo para la pelota
  label: string              // lo que se ve en la ficha: número, apellido, o "⚽"
  playerId: number | null    // id de API-Football, solo si kind === 'player'
  x: number                  // % del ancho de la cancha, 0-100
  y: number                  // % del alto de la cancha, 0-100
}

export type AnnotationColor = 'white' | 'yellow' | 'red' | 'skyblue' | 'black'

export interface FreehandAnnotation { id: string; kind: 'freehand'; color: AnnotationColor; points: { x: number; y: number }[] }
export interface ArrowAnnotation    { id: string; kind: 'arrow';    color: AnnotationColor; x1: number; y1: number; x2: number; y2: number }
export interface ZoneAnnotation     { id: string; kind: 'zone';     color: AnnotationColor; x1: number; y1: number; x2: number; y2: number }
export interface TextAnnotation     { id: string; kind: 'text';     color: AnnotationColor; x: number; y: number; text: string }

export type BoardAnnotation = FreehandAnnotation | ArrowAnnotation | ZoneAnnotation | TextAnnotation

export interface TacticalBoard {
  id: number
  coach_key: string
  name: string
  markers: BoardMarker[]
  annotations: BoardAnnotation[]
  created_at: string
  updated_at: string
}

export async function listTacticalBoards(coachKey: string): Promise<TacticalBoard[]>
export async function createTacticalBoard(coachKey: string, name: string): Promise<TacticalBoard | null>
export async function updateTacticalBoard(id: number, markers: BoardMarker[], annotations: BoardAnnotation[]): Promise<{ success: boolean; error?: string }>
export async function renameTacticalBoard(id: number, name: string): Promise<{ success: boolean; error?: string }>
export async function deleteTacticalBoard(id: number): Promise<{ success: boolean; error?: string }>
```

`x`/`y`/coordenadas de anotaciones son porcentajes (0-100) del contenedor de la cancha, igual que `FormationPage` — así el dibujo se ve igual en cualquier tamaño de pantalla sin recalcular nada al guardar/cargar.

## 4. Geometría — lógica pura testeada

Nuevo módulo `src/features/coaches/tacticalBoard/boardGeometry.ts` (única pieza de lógica no trivial de este sub-proyecto, el resto es orquestación de UI e interacción con el puntero):

```ts
export function clampPercent(value: number): number
export function pointsToPathD(points: { x: number; y: number }[]): string
export function arrowHeadPoints(x1: number, y1: number, x2: number, y2: number, size?: number): { x: number; y: number }[]
```

- `clampPercent`: satura un valor a `[0, 100]` — se usa al arrastrar una ficha o dibujar, para que nada quede fuera de la cancha.
- `pointsToPathD`: convierte una lista de puntos del lápiz a un string `d` de SVG `<path>` (`"M x0 y0 L x1 y1 ..."`), sin puntos devuelve `''`, con un solo punto devuelve un punto fijo (un "punto" de lápiz sin arrastrar).
- `arrowHeadPoints`: dado el inicio/fin de una flecha, calcula los 2 puntos laterales de la cabeza de flecha (triángulo), para dibujar la punta con un `<polygon>`.

## 5. Herramientas y colores — constante compartida

Nuevo archivo `src/features/coaches/tacticalBoardConstants.ts` (mismo patrón que `trainingConstants.ts`/`matchNotesConstants.ts`):

```ts
export const COLOR_META: Record<AnnotationColor, { hex: string; label: string }> = {
  white:   { hex: '#FFFFFF', label: 'Blanco' },
  yellow:  { hex: '#FACC15', label: 'Amarillo' },
  red:     { hex: '#EF4444', label: 'Rojo' },
  skyblue: { hex: '#38BDF8', label: 'Celeste' },
  black:   { hex: '#000000', label: 'Negro' },
}
```

## 6. Interacción — un solo modo activo a la vez

La cancha tiene un "modo" activo, elegido en la barra de herramientas: **Mover** (default), **Lápiz**, **Flecha**, **Zona**, **Texto**. Solo uno a la vez — evita ambigüedad entre "quiero arrastrar una ficha" y "quiero dibujar en ese punto".

- **Mover**: tocar y arrastrar una ficha existente la reposiciona (`pointerdown`/`pointermove`/`pointerup` sobre la ficha, coordenadas convertidas a % del contenedor con `clampPercent`). Tocar una ficha sin arrastrar la selecciona (aro de resaltado) y muestra un botón "Eliminar" flotante para borrarla.
- **Lápiz**: `pointerdown` sobre la cancha arranca un trazo nuevo, `pointermove` va agregando puntos, `pointerup` lo cierra. Se dibuja en vivo con `pointsToPathD`.
- **Flecha**: `pointerdown` fija el inicio, se previsualiza la línea siguiendo el puntero, `pointerup` fija el final y crea la flecha (línea + `arrowHeadPoints`).
- **Zona**: mismo gesto que Flecha (arrastrar de una esquina a otra), pero crea un óvalo semitransparente relleno en vez de una línea — para marcar un sector de la cancha (ej. "presión acá").
- **Texto**: tocar un punto de la cancha abre un input chico ahí mismo; al confirmar (Enter o click afuera) se agrega como anotación de texto en ese punto, con el color activo.

**Deshacer/Borrar:** "Deshacer" saca la última anotación agregada (una sola pila global, no distingue lápiz/flecha/zona/texto — todas entran a la misma secuencia). "Borrar todo" limpia todas las anotaciones (con confirmación, mismo patrón `window.confirm` que ya se usa en Entrenamientos/Notas). Las fichas (jugadores/genéricas/pelota) no se tocan con estos dos botones — se borran individualmente seleccionándolas en modo Mover.

## 7. Agregar fichas

Barra de herramientas con 3 acciones:
- **"+ Ficha"**: agrega una ficha genérica al centro de la cancha con un número editable (empieza en el siguiente número libre 1, 2, 3...), color según el toggle Propio/Rival activo.
- **"+ Jugador"**: abre un selector con el plantel del entrenador (reusa `fetchSquadCached(coach.apiTeamId)`, ya usado en Plantel/Entrenamientos); al elegir uno, aparece su ficha con dorsal + apellido, siempre "Propio" (viene del plantel real).
- **"+ Pelota"**: agrega el marcador de pelota (uno solo — si ya hay uno en la cancha, este botón lo selecciona en vez de duplicar).

Toggle **Propio/Rival** aplica solo a las fichas genéricas nuevas (los jugadores reales son siempre del propio equipo).

## 8. `CoachTacticalBoardTab.tsx` — pestaña nueva

Se agrega **"Pizarra"** a `CoachDetailPage.tsx` (mismo patrón que las demás tabs: `TABS` array, tipo `CoachTab`, `isValidTab`, bloque de render condicional). El tab:
1. Encabezado: nombre de la pizarra actual + botones Nueva / Guardar / Cargar (modal con la lista de pizarras guardadas, mismo estilo que el modal de "Formaciones guardadas" de `FormationPage.tsx`) / Renombrar.
2. Barra de herramientas (Task 7).
3. La cancha interactiva (Task 6).

Guardado: manual con botón "Guardar" (no autoguardado — evita sorpresas de "se guardó algo que no quería"). "Nueva" pide un nombre (input chico) y llama a `createTacticalBoard` en el momento — la pizarra queda creada (vacía) con `id` desde el principio, así "Guardar" siempre es un `updateTacticalBoard` sobre un `id` que ya existe, sin casos especiales de "todavía no tiene id".

## Fuera de alcance

Deshacer/rehacer granular más allá de "sacar la última anotación" (ver sección 6). Borrar un trazo de lápiz puntual del medio de la secuencia (habría que clickear exacto sobre una línea fina, mucho más complejo de lo que vale para esta versión). Exportar la pizarra como imagen. Colaboración en tiempo real entre varios usuarios sobre la misma pizarra. Animación de jugadas (mostrar el movimiento de las fichas paso a paso).

## Testing

- `boardGeometry.test.ts`: `clampPercent` con valores dentro de rango, negativos, y mayores a 100. `pointsToPathD` sin puntos, con un punto, con varios puntos. `arrowHeadPoints` con una flecha horizontal y una en diagonal (verificar que los 2 puntos laterales caen donde corresponde geométricamente, con tolerancia de punto flotante).

# Entrenadores — Notas de partido divididas por fase de juego

## Contexto

Sexto sub-proyecto de la tanda de 8 sobre Entrenadores (ver `docs/superpowers/specs/2026-08-08-entrenadores-domingo-stillitano-design.md` para la lista completa). Cubre el pedido original: dividir la nota de partido en fases de juego — defensiva, ofensiva, transiciones, ABP (acciones a balón parado), observaciones.

Hoy `coach_match_notes` guarda una sola nota de texto libre por partido (`note TEXT NOT NULL`), editada desde el tab **Notas de partidos** (`CoachNotesTab.tsx`, una fila por partido jugado con un textarea y botón "Guardar") y mostrada en modo lectura en la ficha de partido (`CoachMatchDetailPage.tsx`, vía `getMatchNote`).

## 1. Esquema: 5 columnas nuevas + migración de datos existentes

`coach_match_notes` gana 5 columnas de texto libre, todas opcionales (un DT puede no tener nada que anotar en alguna fase de un partido puntual):

```sql
ALTER TABLE public.coach_match_notes
  ALTER COLUMN note DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS defensiva TEXT,
  ADD COLUMN IF NOT EXISTS ofensiva TEXT,
  ADD COLUMN IF NOT EXISTS transiciones TEXT,
  ADD COLUMN IF NOT EXISTS abp TEXT,
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

UPDATE public.coach_match_notes
SET observaciones = note
WHERE observaciones IS NULL AND note IS NOT NULL AND note <> '';
```

`note` deja de escribirse desde la app (queda como columna histórica, sin `NOT NULL`) — las notas ya cargadas se preservan moviéndolas a "Observaciones" en el mismo `UPDATE`, no se pierde nada. No hace falta tocar RLS (la tabla y sus policies ya existen).

## 2. `coachService.ts` — tipos y funciones nuevas, reemplazan a las viejas

Los únicos consumidores de las funciones actuales (`listMatchNotes`, `getMatchNote`, `upsertMatchNote`) son `CoachNotesTab.tsx` y `CoachMatchDetailPage.tsx`, ambos dentro del alcance de este sub-proyecto — se reemplazan enteras, no quedan colgando funciones viejas sin uso.

```ts
export interface MatchNotePhases {
  defensiva: string | null
  ofensiva: string | null
  transiciones: string | null
  abp: string | null
  observaciones: string | null
}

export async function listMatchNotePhases(coachKey: string): Promise<Record<number, MatchNotePhases>>
export async function getMatchNotePhases(coachKey: string, fixtureId: number): Promise<MatchNotePhases | null>
export async function upsertMatchNotePhases(coachKey: string, fixtureId: number, phases: MatchNotePhases): Promise<{ success: boolean; error?: string }>
```

Los `select` son explícitos por columna (`defensiva, ofensiva, transiciones, abp, observaciones` + lo que corresponda) — no `select('*')`, para no acoplar el código a la columna `note` legacy.

## 3. Metadata de fases — constante compartida

Nuevo archivo `src/features/coaches/matchNotesConstants.ts` (mismo patrón que `trainingConstants.ts` del sub-proyecto anterior), consumido tanto por el tab de Notas como por la ficha de partido:

```ts
export const PHASE_META: { key: keyof MatchNotePhases; label: string; placeholder: string }[] = [
  { key: 'defensiva', label: 'Defensiva', placeholder: 'Marca, línea, coberturas...' },
  { key: 'ofensiva', label: 'Ofensiva', placeholder: 'Circulación, generación, definición...' },
  { key: 'transiciones', label: 'Transiciones', placeholder: 'Ataque-defensa y defensa-ataque...' },
  { key: 'abp', label: 'ABP', placeholder: 'Córners, tiros libres, penales...' },
  { key: 'observaciones', label: 'Observaciones', placeholder: 'Otros puntos, contexto del partido...' },
]
```

## 4. `CoachNotesTab.tsx` — filas plegables

Cada partido pasa de "textarea siempre visible" a una fila plegable (colapsar es necesario: 5 cajas × ~20 partidos jugados en la temporada sería una pantalla inmanejable). Colapsada muestra lo mismo que ya muestra hoy (escudo, rival, resultado, fecha) más 5 puntitos chicos — uno por fase, verde si esa fase tiene contenido guardado, gris/vacío si no — para ver de un vistazo qué partidos están completos sin abrir cada uno.

Al tocar la fila se expande: las 5 cajas de texto de `PHASE_META`, cada una con su label y placeholder, y un solo botón "Guardar" que persiste las 5 juntas via `upsertMatchNotePhases` (mismo criterio de guardado conjunto que ya usa `CoachTrainingDayPanel` para varios campos de una sesión). Mismo feedback de estado que ya existe (Guardando.../Guardado ✓/Reintentar).

**Expansión por defecto:** el partido jugado más reciente arranca expandido si no tiene ninguna fase cargada todavía (invita a completarlo apenas se juega); el resto arranca colapsado.

## 5. `CoachMatchDetailPage.tsx` — lectura por fase

El bloque "Nota del DT" (hoy un párrafo único) pasa a listar, de `PHASE_META`, solo las fases que tengan contenido (`getMatchNotePhases` en vez de `getMatchNote`), cada una con su label como subtítulo. Si ninguna fase tiene contenido, el bloque entero no se muestra (mismo comportamiento que hoy con `{note && (...)}`). El link "Editar en Notas de partidos" no cambia.

## Fuera de alcance

Adjuntar imágenes/diagramas a una fase. Notas por fase para partidos rivales (esto es solo para los partidos del propio equipo del entrenador, como ya es hoy). Historial de versiones de una nota (el upsert pisa el valor anterior, mismo comportamiento que ya existe).

## Testing

Sin lógica pura nueva que testear — este sub-proyecto es una extensión de esquema + UI (formulario más campos, mismo patrón de guardado que ya existe sin lógica de cálculo nueva). Mismo criterio ya usado en la sección: sin tests de UI, y acá no hay un módulo puro nuevo que amerite uno.

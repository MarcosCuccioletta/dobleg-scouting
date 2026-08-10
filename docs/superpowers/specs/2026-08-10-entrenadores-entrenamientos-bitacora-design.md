# Entrenadores — Entrenamientos como bitácora semanal con insights

## Contexto

Quinto sub-proyecto de la tanda de 8 sobre Entrenadores (ver `docs/superpowers/specs/2026-08-08-entrenadores-domingo-stillitano-design.md` para la lista completa). Cubre el pedido: repensar el tab **Entrenamientos** para que sea "adictivo" de usar a diario — hoy es un formulario mínimo (fecha + tipo + título) y una lista plana con botón de borrar, sin nada más.

Confirmado con el usuario (pedido abierto, sin más detalle técnico salvo "que sea estético, cómodo, cx, con estilo, funcional y dinámico" y libertad para agregar lo que sirva): la nueva versión tiene tres piezas —

1. **Vista semanal tipo almanaque** (mismo lenguaje visual que el Calendario del sub-proyecto #4) como pantalla principal, en vez de la lista plana.
2. **Carga de sesión más rica**: duración, intensidad (RPE 1-5), notas de contenido, foco del día (tags).
3. **Insights automáticos** calculados por reglas sobre los datos cargados (racha de días, foco predominante, aviso de sobrecarga) — mismo espíritu que el motor de `src/features/informes/insights/` ya existente en el proyecto, no una integración de IA nueva (el proyecto no tiene ninguna integración de LLM hoy; el componente `AIAnalystChat.tsx` es, en realidad, un chatbot de reglas/keywords, no una llamada a un modelo — se sigue ese mismo patrón).

### Alcance de "semana": calendario, no microciclo estricto

El pedido menciona "de partido a partido". Calcular el microciclo real (límites variables según cuándo juega el equipo) agrega lógica de emparejamiento con fixtures que no aporta proporcional al esfuerzo. En su lugar, la semana es **Lunes a Domingo** (mismo criterio que el Calendario del sub-proyecto #4, misma sensación de app consistente), y los partidos de esa semana se muestran directamente en la franja junto a los entrenamientos — el DT ve igual, de un vistazo, cómo se para la semana respecto al partido, sin que el sistema tenga que "adivinar" el microciclo.

## 1. Esquema: extender `coach_training_sessions`

La tabla ya tiene una columna `notes TEXT` sin usar en la UI actual (dead field). Se reusa para el contenido de la sesión. Nueva migración `supabase/migrations/20260810_coach_training_sessions_richer.sql`:

```sql
ALTER TABLE public.coach_training_sessions
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER CHECK (duration_minutes > 0),
  ADD COLUMN IF NOT EXISTS intensity SMALLINT CHECK (intensity BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS focus_tags TEXT[] NOT NULL DEFAULT '{}'::text[];
```

Sin `CHECK` sobre los valores de `focus_tags` (mismo criterio que `raw_metrics JSONB` en `coach_match_team_stats`: la forma la valida la capa de aplicación, no la base). `duration_minutes` e `intensity` quedan nullable — no todas las sesiones necesitan cargar todo.

## 2. `coachService.ts` — tipos y persistencia

Extender `CoachTrainingSession`/`CoachTrainingSessionInput` con los 3 campos nuevos (`duration_minutes: number | null`, `intensity: number | null`, `focus_tags: string[]`) y que `upsertTrainingSession` los persista. `title` se mantiene como el nombre corto obligatorio (lo que ya se ve en listas compactas); `notes` pasa a ser el campo de contenido largo opcional, ahora expuesto en la UI.

## 3. Semana — lógica pura

Nuevo módulo `src/features/coaches/trainingWeek.ts`: dado un día de referencia, calcula las 7 fechas (Lunes a Domingo) de esa semana — misma idea que `calendarMonthGrid.ts` del sub-proyecto #4 pero sin relleno de mes vecino, es solo una semana.

```ts
export function getWeekDates(referenceDateKey: string): string[] // 7 ArDateKeys, Lunes a Domingo
```

## 4. Insights — motor de reglas puro

Nuevo módulo `src/features/coaches/trainingInsights.ts`:

```ts
export interface TrainingInsights {
  hasEnoughData: boolean
  streakDays: number
  topFocus: { tag: string; count: number } | null
  overloadWarning: boolean
}

export function computeTrainingInsights(sessions: CoachTrainingSession[], todayKey: string): TrainingInsights
```

Reglas:
- **`hasEnoughData`**: `sessions.length >= 5`. Si es `false`, el resto de los campos no se muestra en la UI (evita ruido/insights vacíos las primeras cargas) — mismo criterio de "muestra sin sample chico" que usa `informes/insights` (`shortSample`).
- **`streakDays`**: días consecutivos (contando hacia atrás desde `todayKey`, o desde el día cargado más reciente si `todayKey` no tiene sesión) con al menos una sesión cargada. Un día salteado corta la racha.
- **`topFocus`**: el tag de `focus_tags` más frecuente entre las últimas 10 sesiones (por fecha descendente). `null` si ninguna sesión de esa ventana tiene tags cargados. Empate en frecuencia: gana el tag que aparece en la sesión más reciente de las empatadas (desempate determinístico, no alfabético ni azar).
- **`overloadWarning`**: `true` si las últimas 3 sesiones cargadas (por fecha) tienen `intensity >= 4` y ninguna es de tipo `recuperacion`. Sesiones sin `intensity` cargada no cuentan para esta regla (se tratan como si no hubiera dato, no se asume intensidad alta).

## 5. Tags de foco — set fijo

Definidos como constante en el componente (mismo patrón que `TYPE_META` hoy): `Finalización`, `Posesión`, `Pressing`, `Transiciones`, `ABP`, `Físico aeróbico`, `Fuerza`, `Táctico defensivo`, `Táctico ofensivo`. Selección múltiple tipo chips, 0 o más por sesión (no obligatorio).

## 6. `CoachTrainingDayPanel.tsx` — panel de un día

Nuevo componente. Recibe las sesiones de un día puntual (puede haber 0, 1 o varias — la tabla ya lo permitía, un entrenador puede tener sesión de mañana y de tarde) y expone: lista de las sesiones existentes de ese día (tipo, horario si está cargado, duración, intensidad, foco, notas), cada una editable/borrable in-place, más un botón "Agregar sesión" que abre el mismo formulario vacío. El formulario reemplaza al que hoy vive arriba de la página: fecha (ya fija al día del panel, no editable ahí), horario (opcional, ya existía en el schema sin usar), tipo, título, duración, intensidad (selector de 5 puntos), foco (chips), notas.

## 7. `CoachTrainingInsightsBar.tsx` — franja de insights

Nuevo componente chico, puramente de presentación: recibe un `TrainingInsights` y renderiza hasta 3 chips (racha con ícono de llama/rayo, foco predominante, aviso de sobrecarga en rojo si aplica). No se renderiza nada si `hasEnoughData` es `false`.

## 8. `CoachTrainingTab.tsx` — reescritura

Estructura de arriba a abajo:
1. `CoachTrainingInsightsBar` (si hay suficiente data).
2. **Franja semanal**: igual espíritu visual que la grilla del Calendario (flechas prev/next, "Esta semana", 7 columnas) pero de una sola fila — cada día muestra número + puntito(s) de color por tipo de sesión de ese día (reusa `TYPE_META`) + ícono de pelota si hay partido esa semana en ese día (reusa `fetchTeamFixtures`/`mergeCalendarEvents`, mismo dato que ya consume el Calendario). Tocar un día lo selecciona.
3. `CoachTrainingDayPanel` para el día seleccionado (arranca en hoy).
4. **Historial** abajo: la lista plana actual se mantiene tal cual para browsear/buscar semanas viejas, pero cada fila ahora también muestra badges de duración/intensidad/foco cuando están cargados (antes esos campos no existían).

## Fuera de alcance

Cálculo de microciclo real (ver sección de contexto). Gráficos de carga a lo largo de varias semanas (el pedido es que la semana actual "se sienta viva", no un dashboard de series históricas — puede ser una mejora futura si el usuario lo pide). Notificaciones o recordatorios para cargar la sesión del día. Vincular las sesiones de entrenamiento con datos de GPS de jugadores (son sistemas distintos: GPS es rendimiento físico individual de jugadores de la agencia, esto es la planificación del entrenador con su plantel completo).

## Testing

- `trainingWeek.test.ts`: `getWeekDates` devuelve 7 fechas consecutivas empezando en lunes para una fecha de referencia a mitad de semana, y para una fecha de referencia que ya es lunes o domingo (casos borde), y cruzando de un mes/año a otro.
- `trainingInsights.test.ts`: `hasEnoughData` en `false` con menos de 5 sesiones (y que el resto de los campos no importe en ese caso); racha calculada correctamente con y sin cortes; `topFocus` con empate (gana el de la sesión más reciente) y sin tags cargados (`null`); `overloadWarning` en `true`/`false` según los 3 escenarios (alta intensidad seguida, con una de recuperación en el medio, con datos de intensidad faltantes).

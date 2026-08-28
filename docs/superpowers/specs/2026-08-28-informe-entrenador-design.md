# Informe de Entrenador — CV/informe de DT para ofrecer a clubes

**Fecha:** 2026-08-28
**Rama:** por definir (nueva rama de feature)
**Estado:** Diseño validado en mockup, pendiente de plan de implementación

## Objetivo

Mismo objetivo de negocio que **Informes** de jugador (`/informes`), pero para
**entrenadores**: un informe compartible (HTML/PDF) para ofrecer un DT de la agencia —
hoy Nicolás Domingo y Leandro Stillitano — a clubes interesados. La agencia también actúa
a veces como intermediaria de DTs de otros representantes, así que el roster tiene que
poder crecer más allá de los dos actuales.

El diseño se validó de punta a punta como mockup estático (`public/informe-dt-domingo-preview.html`,
ya en el repo, sirve como referencia visual pixel-a-pixel) usando datos reales de Nicolás
Domingo en Temperley (27 partidos, Feb–Ago 2026, export "Team Stats" de Wyscout). El mockup
se borra al integrar esto de verdad — no forma parte de la app.

### Fuera de alcance (explícito)

- Traer datos de Wyscout automáticamente vía scraping/API — se sigue subiendo el archivo
  a mano, igual que Informes de jugador.
- Selección de jugador dentro del informe de DT (comparar plantillas, etc.) — es 100% sobre
  el rendimiento/trayectoria del entrenador.
- Cambiar cómo funciona la ficha de Entrenadores (`/entrenadores/:coachKey`) — esa sección
  sigue existiendo tal cual, con sus propias pestañas (Resumen, Plantel, Calendario, Notas,
  Pizarra, Plantel futuro). El informe es un documento **derivado**, para compartir afuera,
  no un reemplazo de la ficha interna.

## Contexto del código existente

Tres piezas ya construidas, cada una reutilizable para esto:

1. **`/informes`** (jugadores): wizard de 4 pasos (`src/features/informes/`) — subida de
   archivo → métricas → contenido editorial → preview/export/share. Motor de share ya
   resuelto (`netlify/functions/informe.js`, HTML autocontenido en Supabase Storage
   `informes-compartidos`, ver memoria `informes_share_y_features`).
2. **`/entrenadores`** (ficha de DT, `src/features/coaches/`): ya tiene roster hardcodeado
   (`src/constants/agencyCoaches.ts`, hoy 2 entradas: Domingo/Stillitano), fetch de perfil/bio
   vía API-Football (`fetchCoachProfile`), y — clave para esto — **ya sabe parsear el export
   "Team Stats" de Wyscout**: `src/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats.ts`
   (layout fijo de columnas verificado contra un archivo real) + `matchFixtures.ts` +
   `metricLabels.ts`. `CoachTeamVsRivalCharts.tsx`, `CoachSeasonStatsCard.tsx` y
   `CoachDtEfficiencyPanel.tsx` ya calculan comparativas propio-vs-rival con esos datos.
3. **Bug compartido a corregir de paso:** el pill de pestañas usa `backdrop-filter: blur`
   sobre el contenedor rectangular en vez de sobre la píldora redondeada — se ve una costura
   cuadrada. Encontrado y corregido en el mockup; aplica también a los informes de jugador en
   producción (mismo componente de tabs). Corregir en los dos lugares.

**Decisión de arquitectura:** el informe de DT NO reusa el parser genérico de Informes de
jugador (`parseFile.ts` + `metricRegistry.ts`, pensado para filas de jugadores por-90). Reusa
`parseWyscoutTeamStats.ts` de Entrenadores, que ya entiende el layout específico del export
de equipo (dos filas por partido, propio + rival) y ya alimenta los gráficos vivos de la
ficha de DT. Sí se reusa de Informes de jugador: el motor de export/compartir (HTML
autocontenido, `exportInformeHTML.ts`/`shareInforme.ts`), y el patrón general del wizard
(pasos, guardado en Supabase, preview).

## Roster de entrenadores (nuevo, reemplaza el hardcodeo)

Tabla nueva `agency_coaches` en Supabase:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `key` | text unique | slug, ej. `domingo` |
| `full_name` | text | |
| `photo_url` | text nullable | |
| `status` | text | `activo` \| `sin_club` |
| `club` | text nullable | |
| `api_team_id` | int nullable | para traer plantel/calendario en vivo si es cliente propio |
| `league_api_id`, `league_name`, `league_season` | nullable | |
| `coach_api_id` | int nullable | override manual cuando la búsqueda por nombre en API-Football falla |
| `relationship` | text | `propio` \| `intermediado` — si la agencia representa al DT directamente o solo lo está ofreciendo por cuenta de otro representante |
| `active` | boolean default true | para desactivar sin borrar |
| `created_at`, `updated_at` | timestamptz | |

Migración de datos: Domingo y Stillitano pasan de `AGENCY_COACHES` (hardcodeado en
`src/constants/agencyCoaches.ts`) a ser las primeras 2 filas, ambos `relationship = 'propio'`.
El resto de la ficha de Entrenadores (Plantel, Calendario, Liga, Notas, Pizarra) sigue
funcionando igual que hoy — sale en vivo del `api_team_id` del club actual, no se duplica
nada. Formulario nuevo "+ Agregar entrenador" (nombre, foto, club actual si tiene, propio/
intermediado) para que el usuario cargue más DTs sin tocar código.

## El informe de DT: modelo de datos

Reusa el modelo de `Informe` (`src/features/informes/types.ts`) con una nueva variante de
contenido. Cambio mínimo: un campo `tipo: 'jugador' | 'entrenador'` en el informe, y
`InformeContent` se separa en dos formas (jugador ya existente, DT nueva) o se modela como
unión discriminada — a definir en el plan de implementación, pero el criterio es: no forzar
campos de jugador (posición, contrato, goles) en un informe de DT.

**`InformeContentDT` (nuevo):**
- Identidad: nombre, cargo ("Director Técnico"), club actual, liga, sistema habitual, edad,
  foto (reusa la del roster o se puede subir otra)
- Récord en el club actual: PJ, V-E-D, PPG, GF-GC, diferencia de gol, efectividad
- Comparativa vs. rival promedio: por métrica (posesión, duelos, duelos aéreos, precisión de
  pase, tiros totales, xG, PPDA) y por vías de generación de juego (ataque posicional,
  contraataque, balón parado, córner, centros, duelos ofensivos) — **cada valor editable a
  mano** (requisito explícito: corregir errores de carga de Wyscout sin tener que re-subir el
  archivo)
- Sistemas utilizados (formaciones + conteo) y disciplina (faltas, amarillas, rojas)
- Forma reciente (últimos 10 resultados + gráfico de puntos acumulados)
- Gráficos elegibles por el usuario en el paso de métricas del wizard (no fijos):
  radar de perfil táctico (elige qué ejes de los disponibles), gráficos de evolución
  partido a partido (elige cuáles: posesión, xG, duelos, etc., o ninguno)
- Experiencia como jugador (opcional, se completa a mano si aplica): datos personales
  (edad, lugar de nacimiento, altura, posición, pie hábil, selección), títulos (nombre,
  temporada, club — sin buscador de imágenes de trofeos automatizado; ver nota abajo),
  trayectoria de clubes como jugador
- Carrera como entrenador: trayectoria de clubes dirigidos (hoy, para Domingo, un solo
  club — el modelo tiene que soportar que crezca)

**Nota sobre trofeos:** el mockup usa 7 fotos reales de trofeos que el usuario pasó a mano
y se procesaron (remoción de fondo, recorte, incluso un recorte manual por polígono para la
del Liga Profesional que tenía un fondo de sponsors imposible de segmentar limpio
automáticamente). Para la feature real, la opción más simple y sostenible es un **selector
de trofeo por competencia** con un set fijo de imágenes ya preparadas (subidas a
`public/trophies/` o Storage) para las competencias más comunes (Copa Sudamericana, Recopa,
Copa Argentina, Copa de la Liga/Campeón de Argentina, Primera Nacional, Suruga Bank, y
genérica para el resto) — no un flujo de "subí tu propia foto de trofeo y le sacamos el
fondo con IA" (fuera de alcance, no hay herramienta de segmentación confiable instalada).

## Wizard: pasos

1. **Archivo + tipo**: selector Jugador/DT. Si DT: elegir de la lista de `agency_coaches`
   (con acceso directo a "+ Agregar entrenador" si falta uno) en vez de buscar en la DB de
   jugadores. Subida del export "Team Stats" de Wyscout del club actual → `parseWyscoutTeamStats`.
2. **Métricas**: catálogo de métricas de equipo/DT (las que ya calculan
   `CoachSeasonStatsCard`/`CoachDtEfficiencyPanel`/`CoachTeamVsRivalCharts`, más las nuevas
   del mockup — vías de generación de juego). El usuario elige qué ejes van al radar y qué
   gráficos de evolución incluir (o ninguno) — esto es explícitamente decisión del usuario,
   no automático.
3. **Contenido**: versión DT del editor — récord (autocompletado, editable), comparativa vs.
   rival (autocompletada, editable por celda), sistemas/disciplina (autocompletado), forma
   reciente (autocompletado), experiencia como jugador (manual, opcional), carrera como DT
   (autocompletado desde `agency_coaches`/histórico, editable).
4. **Preview/export/share**: igual que jugador — reusa `exportInformeHTML.ts`, `shareInforme.ts`,
   `informesStore.ts` (persistencia), con la plantilla visual del mockup (pestañas: General,
   Comparativa vs rivales, Sistemas, Racha, Carrera como DT, Experiencia como jugador).

## Integración (routing y nav)

No hace falta ruta nueva: vive dentro de `/informes`, que ya está en el nav de "Búsqueda de
Talento". El cambio es el selector Jugador/DT dentro del wizard existente.

## Migraciones pendientes

- `agency_coaches` (tabla + migración de Domingo/Stillitano desde el array hardcodeado)
- Ninguna migración adicional para el modelo `Informe`: hoy persiste en `localStorage`
  (comprimido con lz-string, `informesStore.ts`), no en Supabase — el campo `tipo` y el
  contenido DT se suman ahí, sin tocar infraestructura de base de datos para esta parte.

## Testing

Mismo criterio que el resto del código de Informes/Entrenadores: funciones puras
(cálculo de récord, comparativa vs. rival, agregación de vías de generación de juego) con
tests unitarios; wizard y export verificados en vivo en Chrome con el archivo real de
Temperley antes de dar por terminado.

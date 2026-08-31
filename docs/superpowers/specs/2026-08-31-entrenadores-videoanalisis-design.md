# Entrenadores — Videoanálisis

## Contexto

Pestaña nueva en la ficha de Entrenadores (junto a Resumen, Plantel, Liga, Calendario, Entrenamientos, Notas de partidos, Pizarra táctica, Plantel futuro). Los entrenadores usan programas de videoanálisis con botoneras (Nacsport y similares — LongoMatch, Sportscode) para tagear recortes de partido por categoría ("Salida en corto", "Ataque posicional", "ABP a favor", etc.), y exportan esos tageos como XML. El objetivo es que puedan arrastrar ese XML (más el video del partido, opcional) y ver un análisis visual: cancha, gráficos, evolución en el tiempo.

Dos tipos de análisis, unificados bajo el mismo modelo:
- **Propio equipo** (fijo, uno por entrenador): cada XML subido se ACUMULA — el análisis crece partido a partido.
- **Rivales** (con nombre libre, ej. "Quilmes"): se pueden guardar varios en una lista, y dentro de cada uno también se acumulan los XML que se suban con ese nombre (si el entrenador mira 2 partidos del mismo rival, se suman).

**Riesgo abierto — sin XML real de referencia:** el usuario no tiene un archivo de ejemplo. El parser se construye contra el esquema público conocido de Nacsport/Sportscode (`<ALL_INSTANCES><instance><ID>/<start>/<end>/<code>/<label>...`), documentado más abajo. Hay que validar con el primer archivo real que suba un entrenador y ajustar si hace falta — el parser está escrito para degradar con un error claro en vez de romper si el formato real difiere.

Mockups del layout aprobados con el usuario en `.superpowers/brainstorm/1541-1788181348/content/layout-v3.html` (cancha a un lado, columna de gráficos al otro).

## 1. Esquema: 2 tablas nuevas + 1 bucket de Storage

```sql
CREATE TABLE IF NOT EXISTS public.coach_video_analysis_buckets (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_key   TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('propio', 'rival')),
  name        TEXT,  -- NULL para 'propio' (uno fijo por coach_key); texto libre para 'rival'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cvab_coach ON public.coach_video_analysis_buckets(coach_key);

CREATE TABLE IF NOT EXISTS public.coach_video_analysis_matches (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket_id          BIGINT NOT NULL REFERENCES public.coach_video_analysis_buckets(id) ON DELETE CASCADE,
  match_date         DATE NOT NULL,
  opponent_name      TEXT,
  instances          JSONB NOT NULL DEFAULT '[]'::jsonb,
  video_storage_path TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cvam_bucket ON public.coach_video_analysis_matches(bucket_id);

ALTER TABLE public.coach_video_analysis_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_video_analysis_matches ENABLE ROW LEVEL SECURITY;
-- Mismo patron que coach_tactical_boards: lectura publica, escritura solo autenticado.
CREATE POLICY "read_cvab" ON public.coach_video_analysis_buckets FOR SELECT USING (true);
CREATE POLICY "write_cvab" ON public.coach_video_analysis_buckets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "read_cvam" ON public.coach_video_analysis_matches FOR SELECT USING (true);
CREATE POLICY "write_cvam" ON public.coach_video_analysis_matches FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

`instances` sin `CHECK` de forma (mismo criterio que `markers`/`focus_tags` de sub-proyectos anteriores — la app valida la forma). Los conteos, gráficos y cancha se calculan en el cliente combinando `instances` de todos los matches del bucket que caigan en el rango del slider — sin tablas agregadas que mantener sincronizadas, mismo criterio que Score GG/dtEfficiency.

**Storage:** bucket nuevo `coach-video-analysis` (público, mismo modelo de acceso que fotos de jugador/escudo ya usadas en la app), ruta `${coachKey}/${bucketId}/${matchId}.<ext>`. Límite de tamaño client-side: 500MB por archivo (cubre un partido comprimido a resolución media; se puede subir el límite más adelante si hace falta).

## 2. Parser XML — `parseNacsportXml`

Nuevo módulo `src/features/coaches/videoAnalysis/parseNacsportXml.ts` (lógica pura, testeada con fixtures — mismo patrón que `features/gps/parser/`):

```ts
export interface ParsedInstance {
  code: string
  start: number   // segundos
  end: number     // segundos
  labels: { group: string; text: string }[]
  x: number | null  // 0-100, si el XML trae coordenadas reales
  y: number | null
}

export function parseNacsportXml(xmlText: string): { instances: ParsedInstance[]; warnings: string[] }
```

Busca elementos `<instance>` en cualquier profundidad del documento (no asume una raíz estricta `<file><ALL_INSTANCES>`, por si el exportador real difiere en el wrapper). Por cada uno lee `<ID>`, `<start>`, `<end>`, `<code>`, y junta todos los `<label><group>.../<text>...</text></label>` como pares. Busca coordenadas x/y entre esos labels contra nombres de grupo comunes (`x`/`pos_x`/`posX`, `y`/`pos_y`/`posY`, case-insensitive) — si no encuentra, quedan en `null` y esa instancia no se dibuja como punto exacto en la cancha (cae al Paso 2 de zona por palabra clave, sección 3). Normalización de rango: si todos los valores numéricos encontrados caen en `[0, 1]`, se asume fracción y se multiplica por 100; si ya caen en `[0, 100]` se usan tal cual; cualquier otro rango (ej. píxeles de un video en particular) no se puede normalizar sin más contexto — se descarta la coordenada de esa instancia (cae a `null`) en vez de dibujar un punto en una posición inventada.

Si el documento no tiene ningún `<instance>`, tira un error claro (`No se encontraron cortes en este archivo — ¿es una exportación de Nacsport?`) en vez de devolver un análisis vacío en silencio.

## 3. Clasificación de fase y zona — diccionario extensible

Nuevo módulo `src/features/coaches/videoAnalysis/videoAnalysisTagging.ts`:

```ts
export type ActionPhase = 'defensiva' | 'ofensiva' | 'transicion' | 'abp' | 'otro'

export function classifyPhase(code: string): ActionPhase
// Coincidencia de palabras clave (case/tilde-insensitive, normalizacion NFD igual
// que el resto de la app) contra un diccionario semilla: "salida"/"ataque"/"posesion"
// -> ofensiva, "presion"/"repliegue"/"marca" -> defensiva, "transicion" -> transicion,
// "abp"/"corner"/"lateral"/"tiro libre" -> abp. Sin match -> 'otro'.

export function inferZoneRect(code: string): { x1: number; y1: number; x2: number; y2: number } | null
// Rectangulo aproximado (mismo sistema 0-100 que markers de la Pizarra) para
// terminos de zona conocidos: "izquierda"/"carril 1-2" -> banda izquierda,
// "derecha"/"carril 4-5" -> banda derecha, "centro"/"carril 3" -> centro,
// "defensiv[ao]"/"tercio propio" -> tercio propio, "ofensiv[ao]"/"tercio rival" ->
// tercio rival. Sin match -> null (el corte cuenta en los graficos de barra/torta
// igual, simplemente no se dibuja en la cancha).
```

Diccionario semilla chico y explícitamente ampliable (comentario en el archivo invitando a sumar términos cuando aparezcan en XML reales que no matcheen). Dos instancias con el mismo código pero *distinta zona real* dentro del mismo rectángulo inferido son indistinguibles — es una aproximación, no una posición exacta; el mockup ya comunica esto dibujando un área sombreada en vez de un punto cuando la zona es inferida (vs. un punto amarillo cuando el x/y es real).

## 4. Servicio — `videoAnalysisService.ts`

```ts
export type BucketKind = 'propio' | 'rival'

export interface VideoAnalysisBucket { id: number; coach_key: string; kind: BucketKind; name: string | null; created_at: string }
export interface VideoAnalysisMatch {
  id: number; bucket_id: number; match_date: string; opponent_name: string | null
  instances: ParsedInstance[]; video_storage_path: string | null; created_at: string
}

export async function ensurePropioBucket(coachKey: string): Promise<VideoAnalysisBucket>
// Trae el bucket 'propio' del coach si existe, lo crea si es la primera vez
// (mismo patron que el auto-prellenado de la primera pizarra tactica).
export async function listBuckets(coachKey: string): Promise<VideoAnalysisBucket[]>
export async function createRivalBucket(coachKey: string, name: string): Promise<VideoAnalysisBucket | null>
export async function deleteBucket(id: number): Promise<{ success: boolean; error?: string }>

export async function listMatches(bucketId: number): Promise<VideoAnalysisMatch[]>
export async function createMatch(bucketId: number, matchDate: string, opponentName: string | null, instances: ParsedInstance[]): Promise<VideoAnalysisMatch | null>
export async function deleteMatch(id: number): Promise<{ success: boolean; error?: string }>
export async function uploadMatchVideo(coachKey: string, bucketId: number, matchId: number, file: File, onProgress?: (pct: number) => void): Promise<{ success: boolean; path?: string; error?: string }>
```

## 5. Agregación para gráficos — lógica pura testeada

Nuevo módulo `src/features/coaches/videoAnalysis/videoAnalysisStats.ts`, recibe `VideoAnalysisMatch[]` ya filtrados por el rango de fechas del slider (el filtrado por fecha es un `.filter()` simple sobre `match_date`, vive en el componente):

```ts
export function countByCode(matches: VideoAnalysisMatch[]): { code: string; count: number }[]      // orden desc, para el grafico de barras
export function countByPhase(matches: VideoAnalysisMatch[]): Record<ActionPhase, number>            // para la torta
export function evolutionByMatch(matches: VideoAnalysisMatch[], code: string): { matchDate: string; count: number }[]  // ordenado por fecha, para el grafico de evolucion (top categoria por defecto, elegible)
export function pitchPoints(matches: VideoAnalysisMatch[], code: string): { exact: { x: number; y: number }[]; zones: { x1: number; y1: number; x2: number; y2: number }[] }
```

## 6. UI — `CoachVideoAnalysisTab.tsx`

Se agrega `'videoanalisis'` a `CoachDetailPage.tsx` (mismo patrón `TABS`/`CoachTab`/`isValidTab` que las demás pestañas), ubicada entre Pizarra y Plantel futuro.

Estructura (ver mockup aprobado):
1. **Selector de bucket**: pills "Propio equipo" (fijo) + una por cada rival guardado + "+ Nuevo rival" (abre un input chico para el nombre, crea el bucket al confirmar).
2. **Resumen + filtro**: contador de partidos/cortes/categorías del bucket activo, y slider de rango de fechas de 2 manijas (nuevo componente, interacción por puntero igual que `TacticalBoardPitch` — `pointerdown`/`pointermove`/`pointerup` + `clampPercent`, sin dependencia externa) que filtra qué matches entran en la agregación de abajo.
3. **Cancha + gráficos** lado a lado: cancha (Sección 3/5) a la izquierda, columna con barras por categoría + torta por fase + evolución partido a partido a la derecha.
4. **Lista de partidos cargados** del bucket activo (fecha, rival si aplica, cantidad de cortes, botón "▶" si tiene video) + dropzone para subir el próximo (XML solo, o XML + video juntos; si sube sin video se puede adjuntar uno después desde el mismo partido). Al soltar el XML pide la fecha del partido en un campo simple (no siempre viene confiable en el archivo).
5. Borrado de partido y de rival con `window.confirm`, mismo patrón que Pizarra/Entrenamientos.

**Reproducción de clips:** modal liviano con un `<video>` apuntando al `video_storage_path` público; al abrir desde el botón "▶" de un corte, `video.currentTime = instance.start` y `.play()`; un listener de `timeupdate` pausa automáticamente cuando `currentTime >= instance.end`. Sin transcodificación ni recorte del lado del servidor — el navegador hace *seek* directo sobre el archivo completo.

## Fuera de alcance

Excel como formato de entrada (el usuario lo mencionó de pasada pero sin estructura definida — si aparece un caso real con Excel, se suma después siguiendo el mismo modelo de `instances`). Edición manual de cortes dentro de la plataforma (solo lectura de lo que trae el XML). Comparar 2 partidos lado a lado en una vista dedicada. Ranking de jugadores más tageados (el XML no siempre trae jugador de forma consistente). Exportar el análisis a PDF/imagen. Reproductor de video completo tipo streaming (solo *seek* a clips puntuales). Traducción a los 9 idiomas de esta pestaña (se suma al backlog de i18n en curso como cualquier otra página, no bloqueante para esta versión).

## Testing

- `parseNacsportXml.test.ts`: fixture XML armado a mano contra el esquema documentado en la Sección 2 (varias instancias, con y sin coordenadas, con múltiples labels); caso de XML sin `<instance>` (tira el error esperado); caso de `<label>` sin `<group>`/`<text>` (no rompe, se ignora ese label).
- `videoAnalysisTagging.test.ts`: `classifyPhase` contra los términos semilla de cada fase y un código sin match (-> `'otro'`); `inferZoneRect` contra los términos semilla de cada zona y un código sin match (-> `null`); insensibilidad a mayúsculas/tildes.
- `videoAnalysisStats.test.ts`: `countByCode`/`countByPhase` con instancias de 2+ matches distintos (verifica que se suman entre matches); `evolutionByMatch` con matches en desorden de fecha (verifica que ordena); `pitchPoints` separando exactos de inferidos por zona.

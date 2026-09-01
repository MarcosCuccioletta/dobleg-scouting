# Rating reemplaza a Score GG

## Contexto

Hoy la plataforma calcula un "Score GG" (1-10) propio por jugador: una fórmula ponderada por puesto (`SCORING_WEIGHTS` en `supabase/functions/_shared/scoring.ts`) que combina métricas normalizadas por ranking (duelos ganados, pases, goles/90, etc.) más el `rating` crudo del proveedor de datos (Sofascore/API-Football) como un ingrediente más (peso 8-20% según puesto). El usuario siente que este scoring "está muy alterado" — depende de detección de posición (ruidosa, ver `legacy_wyscout_metrics_bug`/memoria del proyecto) y de ponderaciones elegidas a criterio propio, no de un dato objetivo.

Decisión: eliminar el Score GG por completo y que el **rating crudo del proveedor** (promediado por temporada, sin re-ponderar ni re-escalar) pase a ser el número principal en toda la plataforma, con el nombre "Rating" (se abandona la marca "Score GG").

El dato ya existe: `player_season_scores.avg_rating` (promedio de temporada del `rating` de cada partido) se calcula hoy en paralelo a `avg_score` — no hay que construir un pipeline de datos nuevo, es sobre todo un cambio de qué campo se usa y de limpieza del código que ya no hace falta.

**Validado contra la base real (2026-09-01):** para jugadores con datos en temporada 2025+, `avg_rating` se distribuye así (n=7798 con ≥5 PJ): p5=6.50, p25=6.70, p50=6.80, p75=7.00, p90=7.10, p95=7.30, min=5.70, max=8.60. Es un rango mucho más comprimido que el 1-10 de Score GG — esto condiciona la sección 5 (velocímetro).

**Decisiones ya tomadas con el usuario (no reabrir sin motivo):**
- El valor mostrado es el rating crudo tal cual, **sin** re-escalar a percentil 1-10.
- **Sin mínimo de partidos jugados** para mostrar el rating (a diferencia de lo que se había planteado para Score GG).
- El código de cálculo ponderado se **elimina del todo**, no se deja dormido.
- Si algo queda mal calibrado (ej. los cortes del velocímetro), se ajusta después — no bloquea este trabajo.

## 1. Qué se elimina

- `SCORING_WEIGHTS`, `calculateMatchScore`, `calculateSeasonScore`, `normalizeToScale`, `rankNormalize` en `supabase/functions/_shared/scoring.ts` (o el archivo entero si no queda nada útil).
- La escritura de `match_score` (nivel partido) en `sync-player-stats/index.ts` y `sync-sofascore/index.ts`.
- La escritura de `avg_score`, `percentile`, `global_percentile` (si están atados a la fórmula ponderada) en `recalc-scores/index.ts`.
- La edge function `recalc-match-scores` completa (verificado: su único propósito es recalcular `match_score` retroactivamente, no queda nada más que preservar).
- El cron de `recalc-scores` se mantiene pero se simplifica (ver sección 2) — no se apaga, porque el pool de "todos los jugadores del puesto" para el percentil en vivo sigue necesitando refrescarse.
- Columnas `match_score` (player_match_stats) y `avg_score` (player_season_scores): se dejan en la tabla (no se dropean columnas en este trabajo — bajo riesgo, alto valor de mantenerlas por si hace falta auditar/revertir; simplemente dejan de escribirse). Si en el futuro se quiere limpiar el esquema, es una migración aparte.
- Todos los tests que testean específicamente la fórmula ponderada (`scoring.test.ts`, partes de `mergeSeasonFragments.test.ts` referidas a `avg_score`, `applyScoreGG.test.ts` si testea la fórmula vieja).
- Referencias a "Score GG" como texto/label en toda la UI (búsqueda de string, no solo los archivos ya identificados).

## 2. Qué reemplaza a cada pieza (data layer)

- **Nivel partido:** donde hoy se lee/muestra `match_score`, pasa a leerse `rating` (campo ya existente en `player_match_stats`, viene directo del proveedor). Esto incluye el historial de partidos de la ficha (`fetchPlayerMatchHistory` en `playerStatsService.ts`, que hoy filtra `match_score is not null` — pasa a filtrar por `rating is not null`).
- **Nivel temporada:** donde hoy se lee `avg_score`, pasa a leerse `avg_rating`. Esto es el campo que alimenta `primary_score` en `PlayerWithScore`/`RecentFormPlayer` y `ggScore` en las filas de tabla (`applyScoreGG` y afines) — el punto de entrada es único, no hace falta tocar cada pantalla consumidora por separado.
- **`fetch_recent_form` RPC** (`supabase/migrations/20260710120000_recent_form_rpc.sql`): hoy promedia `match_score` de los últimos N partidos en una ventana y compara contra `primary_score` (temporada) para marcar `on_the_rise`. Migración nueva que reemplaza `match_score` → `rating` y `avg_score` → `avg_rating` en la función. Misma mecánica, misma forma de respuesta (`recent_avg`, `recent_scores`, `on_the_rise`, `window_used`), sin romper el contrato con el frontend.
- **Percentiles `percentile` (por liga) y `global_percentile` (cross-league)**: hoy los rellenan RPCs de recálculo (`20260521202959_recalc_percentiles_rpc.sql` y siguientes) a partir del ranking de `avg_score`, y se muestran en dos lugares distintos con nombres distintos — "Top X%" en `PlayerDetailPage.tsx` (`activeSeasonScore.percentile`) y "Percentil Global" en `SupabasePlayerDetail.tsx` (`activeScore.global_percentile`). Esto **no se consolida ni se rediseña** — es una duplicación preexistente ajena a este cambio. Ambos pasan a calcularse rankeando por `avg_rating` en vez de `avg_score`, preservando exactamente el mismo comportamiento/alcance (per-liga vs cross-league) que tienen hoy.

## 3. Piezas derivadas

- **Oportunidades** (`src/utils/opportunities.ts`): `opportunityScoreFor` ya es agnóstico (`recent_avg + contractBoostFor(...)`) — no cambia su lógica, solo cambia lo que trae `recent_avg` (ver RPC arriba). `marketTagsFor`, `detectOpportunities` usan `primary_score`, que ya viene de `avg_rating` desde el punto único de entrada.
- **Radar/Comparación** (`RadarAnalysisPage`, `ComparisonPage`): normalizan cada métrica individual por percentil en el momento, no dependen del Score GG compuesto — sin cambios, salvo que si `avg_rating`/`rating` es una de las métricas listadas en `apiMetrics.ts` (ya lo es: `avg_rating`), sigue funcionando igual.
- **Jugadores similares** (`similarity.ts`): usa `primary_score`/`avg_score` como una feature más de similitud — pasa a usar el valor ya resuelto por el punto único de entrada, sin lógica propia que tocar.
- **Formaciones** (`formationService.ts`, campo `ggScore`): el algoritmo de mejor XI ordena por `ggScore` — sin cambios de lógica, solo el origen del valor.
- **PDF export** (`pdfExport.ts`, `AnalisisCompletoPDF.tsx`) y **chat IA** (`AIAnalystChat.tsx`, filtra/ordena por `ggScore`): sin cambios de lógica.
- **Plantel futuro de Entrenadores** (`futureSquadPrefill.ts`, `CoachFutureSquadTab.tsx`, `FutureSquadPitch.tsx`): mismo criterio, usan el valor ya resuelto.
- **`score_history` / `scoreHistoryService.ts`:** guarda snapshots históricos de `gg_score`/`opportunity_score` por jugador. Se mantiene la tabla (es historial, no se reescribe el pasado), pero el snapshot nuevo que se guarde de acá en adelante refleja el rating, no el score ponderado — es un cambio de contenido, no de esquema.

## 4. Nombre y textos

Búsqueda y reemplazo de todo texto de UI ("Score GG", "GG Score", labels/tooltips relacionados) por "Rating". Incluye (no exhaustivo, confirmar con grep antes de dar por cerrado):
- Velocímetro/gauge (`GaugeScore`/`ScoreBar` — nombre de componente puede quedar igual, es interno; lo que cambia es el label visible).
- Columnas de tablas (`PlayerTable.tsx`, listas de Externo/Interno).
- Fichas de jugador (`PlayerDetailPage.tsx`, `SupabasePlayerDetail.tsx`).
- Modales de vínculo (`LinkPlayerModal.tsx`).
- PDF (`AnalisisCompletoPDF.tsx`, `pdfExport.ts`).
- Chat IA (`AIAnalystChat.tsx` — tanto el copy que arma como cómo interpreta pedidos del usuario tipo "ordename por score").
- Traducciones: `translations.ts` tiene claves con "Score GG"/"score" en varios namespaces (9 idiomas) — actualizar las que sean visibles, no solo español.

`feedback_score_gg_name` (memoria del proyecto: "nunca renombrar Score GG") queda **superada explícitamente por esta decisión** — se actualiza esa memoria al cerrar el trabajo.

## 5. Velocímetro — recalibración

Cortes actuales (pensados para el ranking 1-10 de Score GG): elite ≥8.0, bueno ≥5.5, bajo <3.5.

Cortes propuestos para `avg_rating` crudo, basados en la distribución real medida (sección Contexto): **bajo <6.6, bueno 6.6–7.1, elite >7.1**. Esto es una primera aproximación (percentil ~25 y ~90 reales); se ajusta mirando el resultado real en pantalla con jugadores conocidos antes de dar por cerrada la calibración — no es un valor sagrado.

`GaugeScore`/`ScoreBar` reciben hoy un prop `scale` (`'10'` vs `'100'`, ver memoria `score_gg_escala_unica`) — se mantiene `scale="10"` porque el rating sigue siendo una escala de 1 a 10, solo cambian los **cortes de color/calificación** dentro de esa escala, no el rango del componente.

## 6. Orden de implementación

1. **Backend/datos:** dejar de calcular `match_score`/`avg_score` en las edge functions de sync y recalc; migración SQL para `fetch_recent_form` y para los RPCs de percentil (rating en vez de match_score/avg_score); borrar `recalc-match-scores`; deploy de las funciones tocadas.
2. **Frontend — Búsquedas y tablas:** Scout Externo, Scout Interno, `PlayerTable`, filtros/orden por score → rating. Commit + verificación visual en Chrome.
3. **Frontend — Fichas individuales:** `PlayerDetailPage`, `SupabasePlayerDetail`, velocímetro recalibrado, badge "Top X%". Commit + Chrome.
4. **Frontend — Formaciones, Comparación, Oportunidades:** `formationService`, `RadarAnalysisPage`, `ComparisonPage`, `opportunities.ts`. Commit + Chrome.
5. **Frontend — PDF y chat IA:** `AnalisisCompletoPDF`, `pdfExport.ts`, `AIAnalystChat`. Commit + Chrome (exportar un PDF real, probar un pedido de chat que ordene por score).
6. **Limpieza final:** borrar/actualizar tests obsoletos, grep final de "Score GG"/"ggScore" residual en todo el repo (código y traducciones), actualizar memoria `feedback_score_gg_name`.

Cada etapa se commitea por separado (no un solo commit gigante), siguiendo el patrón ya usado para i18n — permite revisar y, si algo se rompe, aislar en qué etapa fue.

## 7. Testing y verificación

- `npx tsc --noEmit` y `npx vitest run` limpios después de cada etapa (no solo al final).
- Grep de residuales de `avg_score`/`match_score`/`ggScore`-como-fórmula/"Score GG" al cerrar cada etapa relevante, no solo al final (mismo error que se dio con i18n: una cosa es que compile, otra que no haya quedado un texto/campo viejo sin reemplazar).
- Verificación visual en Chrome MCP por etapa (regla de la casa: code review en verde no alcanza para UI) — comparar antes/después con 2-3 jugadores conocidos (uno con muchos partidos, uno con pocos, uno sin datos de API) para confirmar que el número que se ve tiene sentido y que "sin datos" se sigue mostrando como tal (nunca inventar un rating).
- No se toca la regla existente de "si la API no tiene al jugador, el valor queda en null" (memoria `score_gg_escala_unica`) — se preserva 1:1, solo cambia qué campo se consulta.

## Riesgos / qué NO cambia

- No se re-normaliza el rating por percentil para el número principal (decisión explícita, ver Contexto) — el efecto esperado es que el rating se vea "amontonado" (la mayoría 6.5-7.3); es aceptado como trade-off consciente.
- No se toca el merge multi-proveedor (Sofascore + API-Football) existente en `mergeSeasonFragments.ts` más allá de que ahora `avg_rating` es el campo relevante en vez de `avg_score` — la lógica de cómo se combinan fragmentos de temporada entre proveedores no cambia.
- No se dropean columnas de base de datos en este trabajo (bajo riesgo de dejarlas sin usar vs. alto riesgo de una migración destructiva innecesaria).
- El "PJ mínimo" que estaba pendiente para Score GG (memoria `scoring_gg_rework`) queda descartado para Rating por decisión explícita del usuario — no es un olvido.

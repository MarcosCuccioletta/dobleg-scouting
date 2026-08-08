# Oportunidades: boost por contrato + widget de Inicio por puesto

## Contexto

El feature de Oportunidades ([[oportunidades-forma-reciente-y-metricas-evolutivas]], 2026-07-10) rankea jugadores externos por Score GG reciente (`recent_avg`, del RPC `fetch_recent_form`), con tags informativos "Precio bajo" y "Fin de contrato" que hoy solo filtran/etiquetan, sin afectar el orden.

Dos cambios pedidos:
1. Un jugador con contrato por vencer pronto (6 meses mejor que 12) debería aparecer más arriba en el ranking, no solo llevar un tag.
2. El widget de Oportunidades en Inicio (`OpportunityHero.tsx`) hoy muestra 1 tarjeta rotativa tomada de un top-8 global. Pasa a mostrar el top 8 de **cada una** de las 8 posiciones (ARQ, LD, DFC, LI, VC, VI, EXT, DEL), navegable por pestañas.

## 1. `opportunity_score`: boost por contrato

Nueva función en `src/utils/opportunities.ts`, usada solo para **ordenar** — el número que se muestra en las tarjetas sigue siendo `recent_avg` (Score GG), sin cambios en esa marca ([[score-gg-naming]], [[score-gg-escala-unica]]).

```ts
const CONTRACT_BOOST_MAX = 1.5      // puntos máximos de boost
const CONTRACT_BOOST_MONTHS = 12    // a partir de acá, boost = 0

function contractBoostFor(contractEndDate: string | null): number {
  const months = monthsToContractEnd(contractEndDate)
  if (months === null || months < 0 || months > CONTRACT_BOOST_MONTHS) return 0
  const proximity = 1 - months / CONTRACT_BOOST_MONTHS   // 0 en 12m, 1 en 0m
  return CONTRACT_BOOST_MAX * Math.min(Math.max(proximity, 0), 1)
}

function opportunityScoreFor(p: RecentFormPlayer): number {
  return p.recent_avg + contractBoostFor(p.contract_end_date)
}
```

Notas:
- Crece gradual (12m → ~0, 6m → 0.75, 0m → 1.5). Sin escalones bruscos.
- Contrato ya vencido (`months < 0`) → boost 0, igual que sin `contract_end_date`. **Cambiado tras el smoke test del 2026-08-08**: el `contract_end_date` viene de Transfermarkt vía sync semanal (`enrich-player`, cron domingos 3am UTC) y puede quedar desactualizado tras una renovación o transferencia que Transfermarkt no reflejó a tiempo. Verificado con 2 casos reales (Carlos Moreno, Pachuca: renovó hasta 2028 pero el dato en base decía 2026-06-30; Jorge Hurtado, préstamo en Tolima: contrato real hasta 2027, dato en base decía 2026-06-30) — ambos habrían recibido el boost máximo (1.5) por error, superando a jugadores con contrato realmente por vencer y tag visible. Una fecha vencida es más señal de dato stale que de agente libre confirmado, así que no suma boost.
- Sin `contract_end_date`, boost 0 — no penaliza, solo no suma.
- El rendimiento (`recent_avg`) sigue pesando más que el contrato: un +1.5 no alcanza para que un jugador mediocre le gane a uno realmente destacado.

## 2. Widget de Inicio (`OpportunityHero.tsx`)

Rediseño completo del componente (mismo archivo, mismo punto de uso en `HomePage.tsx:612`, sin cambios en la integración).

**Datos:** `useRecentForm({ windowMonths: 3, cheapMaxValue, contractMaxMonths, limit: 200 })` en vez de `limit: 8` — trae el pool completo de oportunidades vigentes, no solo el top global.

**Agrupado:** función nueva `topByPosition(players, positions, n)` en `src/utils/opportunities.ts`:
- Orden fijo de posiciones: `['ARQ', 'LD', 'CB', 'LI', 'VC', 'VI', 'EXT', 'DEL']` (coincide con `Position` en `types/scoring.ts`).
- Por cada posición: `players.filter(p => p.primary_position === pos).sort by opportunity_score desc).slice(0, 8)`.
- Devuelve `Record<Position, RecentFormPlayer[]>`.

**UI:**
- Header igual que hoy: título "Oportunidades de mercado" + link "Ver más oportunidades" → `/oportunidades` (sin cambios).
- Fila de 8 pestañas (una por posición, label vía `displayPosition`), estilo pill — mismo lenguaje visual que la fila de jugadores que ya existe hoy en el componente.
- Debajo, carrusel horizontal (scroll-x) con las tarjetas de la posición activa (hasta 8). Tarjeta compacta: foto, nombre, equipo, Score GG + PJ, tags, sparkline — mismo contenido que la tarjeta única de hoy pero en formato mini.
- Posición sin candidatos: la pestaña se muestra igual (siempre 8, mismo lugar) pero el carrusel muestra "Sin oportunidades por ahora".
- Pestaña activa por defecto: la primera posición del orden fijo que tenga al menos un candidato.
- Se elimina el auto-rotado cada 5s (no aplica al nuevo formato de navegación por click).
- Se sigue excluyendo jugadores de la agencia vía `excludeAgencyPlayers` (sin cambios).

## 3. Página `/oportunidades` (`OpportunitiesPage.tsx`)

Cambio mínimo: `filteredPlayers` se ordena por `opportunityScoreFor` desc antes de renderizar la grilla, en vez de heredar el orden del RPC (`recent_avg` desc). Filtros, tarjetas, selector de Posición y todo lo demás quedan igual.

## 4. Testing

`opportunities.test.ts` — casos nuevos:
- `contractBoostFor`: 0 meses (~1.5), 6 meses (~0.75), 12 meses (~0), >12 meses (0), sin fecha (0), fecha vencida/negativa (satura en 1.5).
- `opportunityScoreFor`: `recent_avg + boost`.
- `topByPosition`: agrupa correctamente, respeta el orden fijo de posiciones, corta en 8, devuelve grupo vacío (no undefined) para una posición sin candidatos.

## Fuera de alcance

- No se toca el RPC `fetch_recent_form` (Supabase) — el cálculo de `opportunity_score` es 100% client-side sobre datos ya traídos.
- No se agrega el boost por precio bajo — el pedido fue específicamente sobre contrato.
- No cambia el badge de Score GG que se muestra en ninguna tarjeta.

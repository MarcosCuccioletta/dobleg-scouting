# Selector de moneda USD/EUR

**Fecha:** 2026-08-17
**Estado:** Aprobado para plan de implementación

## Contexto

Toda la app muestra valores de mercado en euros (`€600k`, `€12.00m`), porque la
fuente de los datos es Transfermarkt (vía la Edge Function `enrich-player`,
que scrapea y guarda `market_value_eur` en Supabase). El usuario pidió un
selector de moneda junto al botón de tema (la luna), para mostrar dólares por
defecto y euros si el usuario lo prefiere — persistente, dinámico, con el
tipo de cambio del día.

Este spec es el primero de dos proyectos independientes pedidos en la misma
conversación (el segundo es i18n en 9 idiomas, que se aborda después). No
comparte código con Clubes y Copas / Logros (proyecto recién mergeado a
main) más allá de vivir en el mismo repo.

## Estado actual (relevante para el diseño)

- **Fuente de verdad**: `players.market_value_eur` (Supabase, entero, EUR) para jugadores con fila en la tabla `players`. Para jugadores de agencia sin esa fila (`AgencyPlayer.marketValue`, 39 strings hardcodeados tipo `'€600k'` en `agencyPlayers.ts`, o cargados por overlay de `agency_players`), el valor crudo se recupera parseando el string con `parseMarketValue()` (`src/utils/scoring.ts`) — función ya existente, cubre `€200k`, `€2.80m`, formato "900 mil €", etc. **No hay ningún jugador sin un valor crudo en EUR disponible.**
- **El problema real**: no hay una función central de formateo. Hay **9 implementaciones locales casi idénticas** de `formatValue`/`formatMarketValue` (`DashboardPage.tsx`, `ExternalScoutingPage.tsx`, `ComparisonPage.tsx`, `OpportunitiesPage.tsx`, `SupabasePlayerDetail.tsx`, `PortfolioValueChart.tsx`, `MarketValueChart.tsx`, `FilterSidebar.tsx`, `BusquedaPage.tsx`), más `utils/scoring.ts::formatMarketValue` que ya es la "central" pero solo la usan 2 de los 9 sitios.
- Varios componentes no formatean nada — consumen directamente `EnrichedPlayer.marketValueFormatted`, un **string ya congelado** con el símbolo `€` incluido, calculado una vez al construir cada jugador en `DataContext.tsx`. Estos son: `PlayerDetailPage.tsx`, `InternalScoutingPage.tsx`, `PlayerTable.tsx` (columna "Valor" de las tablas de Scouting Interno/Externo), `DobleGWidget.tsx`, `pdfExport.ts`, `InformeCanvaCard.tsx`.
- **Caso especial sin solución dinámica**: `content.valorMercado` en Informes (`src/features/informes/`) es un campo de **texto libre editable** por el usuario (`Step3Contenido.tsx`) — se autocompleta en EUR al elegir un jugador (`Step1Archivo.tsx`), pero una vez que el usuario lo edita a mano ya no es un número parseable de forma confiable. Queda fuera de alcance: se autocompleta en la moneda activa al momento de generar el informe, pero no se re-convierte después si el usuario lo edita.
- **Patrón a replicar**: `ThemeContext.tsx` — Provider con `useState` inicializado desde `localStorage`, con validación del valor guardado, `useEffect` que persiste cambios, hook `useX()` que tira error fuera del provider. Sin precedente de fetch de tipo de cambio en el repo — es nuevo.
- **Ubicación del botón**: `Navbar.tsx` línea ~315, junto a `<ThemeToggle />` en el cluster `<div className="flex items-center gap-2">` del lado derecho — ya responsive (mismo contenedor que hoy se ve bien en desktop/tablet/mobile).

## Fuera de alcance

- `content.valorMercado` de Informes (texto libre editable) no se re-convierte retroactivamente — se autocompleta en la moneda activa al generar el informe, es una foto fija del momento.
- i18n (segundo proyecto, spec aparte).
- Cualquier moneda que no sea USD/EUR.

## Arquitectura

### 1. Tipo de cambio

Nuevo `src/services/exchangeRateService.ts`:

```ts
export interface ExchangeRate {
  rate: number       // 1 EUR = `rate` USD
  date: string        // fecha del dato, 'YYYY-MM-DD'
}

export async function fetchEurUsdRate(): Promise<ExchangeRate>
```

- Fuente: [Frankfurter.app](https://www.frankfurter.app) (`GET https://api.frankfurter.app/latest?from=EUR&to=USD`) — tasas oficiales del Banco Central Europeo, sin API key, sin costo. Se llama directo desde el cliente (no necesita pasar por el proxy server-side de API-Football, no hay key que ocultar).
- Cache en `localStorage` (clave `gg-eur-usd-rate`, con la fecha del dato adentro) — se refresca como máximo una vez por día calendario. El BCE no publica fines de semana/feriados: si `fetchEurUsdRate()` devuelve la misma fecha que ya está cacheada, no hace falta re-pedir.
- Fallback en cadena si el fetch falla: (a) último valor cacheado, sin importar la antigüedad — mejor una tasa vieja que romper la conversión; (b) si nunca hubo un fetch exitoso, una constante de emergencia razonable (`1.08`, documentada con un comentario y la fecha en que se fijó) para que la app nunca se rompa por falta de red.

### 2. Contexto de moneda

Nuevo `src/context/CurrencyContext.tsx`, mismo patrón que `ThemeContext.tsx`:

```ts
export type Currency = 'USD' | 'EUR'

interface CurrencyContextType {
  currency: Currency
  setCurrency: (c: Currency) => void
  rate: number        // 1 EUR = `rate` USD, del ExchangeRate cacheado/fetcheado
  rateDate: string | null
}
```

- `localStorage` clave `gg-currency`, default `'USD'` (como pidió el usuario — dólares salvo que el usuario elija euros, y ahí se le muestra en euros de ahí en adelante).
- Al montar, dispara `fetchEurUsdRate()` una vez (no bloqueante — mientras no resuelve, `rate` usa el fallback en cadena de arriba, así que nunca hay una pantalla en blanco esperando la tasa).

### 3. Formateador central (reemplaza las 9 implementaciones duplicadas)

En `src/utils/scoring.ts`, reemplaza la actual `formatMarketValue`:

```ts
export function formatMarketValue(
  valueEUR: number,
  currency: Currency,
  rate: number,
): string
```

- Convierte `valueEUR * rate` si `currency === 'USD'`, deja igual si `'EUR'`.
- Formatea con el símbolo correspondiente (`$`/`€`) + sufijo `K`/`M`, mismo criterio de redondeo que la implementación actual (M con 1 decimal, K redondeado, `-` si 0/vacío) — sin cambiar el formato numérico, solo parametrizando moneda y agregando la conversión.

### 4. Migración de los sitios existentes

Dos grupos, mismo resultado final (todo lee `useCurrency()` + `formatMarketValue`, nada queda con un string de moneda congelado):

**Grupo A — sitios que hoy formatean con una función local propia** (9 archivos listados arriba en "Estado actual"): reemplazar la función local por una llamada a `formatMarketValue(valueEUR, currency, rate)` usando `useCurrency()`.

**Grupo B — sitios que hoy consumen `EnrichedPlayer.marketValueFormatted` directamente** (`PlayerDetailPage.tsx`, `InternalScoutingPage.tsx`, `PlayerTable.tsx`, `DobleGWidget.tsx`, `pdfExport.ts`, `InformeCanvaCard.tsx`): pasan a leer `marketValueRaw` (ya existe, siempre en EUR) y formatear en el momento del render con `useCurrency()` + `formatMarketValue`, en vez de leer el string pre-calculado. El campo `marketValueFormatted` en el tipo `EnrichedPlayer`/`MonitoringPlayer` se elimina una vez que no quede ningún consumidor (si algo no puede migrar por estar fuera de un componente React — ej. `pdfExport.ts`, que es una función plana llamada desde un componente — recibe `currency`/`rate` como parámetro en vez de leer el contexto directamente).

### 5. UI — botón

Nuevo `src/components/layout/CurrencyToggle.tsx`, mismo esqueleto visual que `ThemeToggle.tsx` (mismo padding, hover, radio, transición), alternando el símbolo mostrado ($/€) al hacer click. Se monta en `Navbar.tsx` junto a `<ThemeToggle />`, en el mismo cluster responsive.

## Testing

- `exchangeRateService.ts`: test de la lógica de cache/fallback (fetch exitoso actualiza cache; fetch fallido usa el último valor cacheado; sin cache y sin red usa la constante de emergencia) — mockeando `fetch`, no llamando a la API real.
- `formatMarketValue`: test de conversión + formato para ambas monedas, valores en K/M, cero/vacío.
- Componentes (`CurrencyToggle`, `CurrencyContext`): sin test automático, siguiendo la convención del repo (solo funciones puras) — verificación manual en navegador antes de dar por terminado.

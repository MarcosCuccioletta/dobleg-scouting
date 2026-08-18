export interface ExchangeRate {
  rate: number // 1 EUR = `rate` USD
  date: string // 'YYYY-MM-DD', fecha del dato del BCE
}

// Fijada 2026-08-17 como piso de emergencia si nunca hubo un fetch exitoso
// ni una tasa cacheada — mejor una conversión aproximada que romper la UI.
export const FALLBACK_EUR_USD_RATE = 1.08

const CACHE_KEY = 'gg-eur-usd-rate'

function todayKey(): string {
  return new Date().toISOString().split('T')[0]
}

function getCached(): ExchangeRate | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ExchangeRate
  } catch {
    return null
  }
}

function setCached(rate: ExchangeRate) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rate))
  } catch { /* quota */ }
}

export async function fetchEurUsdRate(): Promise<ExchangeRate> {
  const cached = getCached()
  if (cached && cached.date === todayKey()) return cached

  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD')
    if (!res.ok) throw new Error(`Frankfurter API error: ${res.status}`)
    const data = await res.json()
    const rate: ExchangeRate = { rate: data.rates.USD, date: data.date }
    setCached(rate)
    return rate
  } catch {
    if (cached) return cached
    return { rate: FALLBACK_EUR_USD_RATE, date: todayKey() }
  }
}

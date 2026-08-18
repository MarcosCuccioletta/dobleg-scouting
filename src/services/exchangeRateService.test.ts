import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { fetchEurUsdRate, FALLBACK_EUR_USD_RATE } from './exchangeRateService'

const CACHE_KEY = 'gg-eur-usd-rate'

describe('fetchEurUsdRate', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pide la tasa a Frankfurter y la cachea', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ amount: 1, base: 'EUR', date: '2026-08-15', rates: { USD: 1.0923 } }),
    }))

    const result = await fetchEurUsdRate()

    expect(result).toEqual({ rate: 1.0923, date: '2026-08-15' })
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY)!)
    expect(cached).toEqual({ rate: 1.0923, date: '2026-08-15' })
  })

  it('no vuelve a pedir si ya hay una tasa cacheada de hoy', async () => {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: 1.05, date: today }))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchEurUsdRate()

    expect(result).toEqual({ rate: 1.05, date: today })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('si el fetch falla, devuelve la última tasa cacheada aunque sea de otro día', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: 1.02, date: '2020-01-01' }))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const result = await fetchEurUsdRate()

    expect(result).toEqual({ rate: 1.02, date: '2020-01-01' })
  })

  it('sin cache y sin red, devuelve la tasa de emergencia', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const result = await fetchEurUsdRate()

    expect(result.rate).toBe(FALLBACK_EUR_USD_RATE)
  })

  it('si la API responde ok:false, trata igual que un fetch fallido (usa cache/fallback)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const result = await fetchEurUsdRate()

    expect(result.rate).toBe(FALLBACK_EUR_USD_RATE)
  })
})

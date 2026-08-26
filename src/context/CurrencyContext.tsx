import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchEurUsdRate, FALLBACK_EUR_USD_RATE } from '@/services/exchangeRateService'

export type Currency = 'USD' | 'EUR'

interface CurrencyContextType {
  currency: Currency
  setCurrency: (c: Currency) => void
  rate: number // 1 EUR = `rate` USD
  rateDate: string | null
}

const CurrencyContext = createContext<CurrencyContextType | null>(null)

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>(() => {
    const stored = localStorage.getItem('gg-currency')
    return (stored === 'USD' || stored === 'EUR') ? stored : 'USD'
  })
  const [rate, setRate] = useState(FALLBACK_EUR_USD_RATE)
  const [rateDate, setRateDate] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem('gg-currency', currency)
  }, [currency])

  useEffect(() => {
    let active = true
    fetchEurUsdRate().then(result => {
      if (!active) return
      setRate(result.rate)
      setRateDate(result.date)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rate, rateDate }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency(): CurrencyContextType {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}

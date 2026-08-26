import { useCallback, useEffect, useState } from 'react'
import { fetchClassifications, type AgencyClass } from '@/services/agencyClassificationService'

let cached: { data: Map<string, AgencyClass>; timestamp: number } | null = null
const CACHE_TTL_MS = 60_000

/** Lectura de clasificaciones para consumidores de solo-lectura (columna en
 * Scout Interno, badge en la ficha, widget de Panel Interno). La página de
 * edición (`InternalClassificationPage`) mantiene su propio estado local en
 * vez de depender de este cache, para no arrastrar datos viejos mientras se
 * arrastran jugadores entre clases. */
export function useAgencyClassifications() {
  const [classifications, setClassifications] = useState<Map<string, AgencyClass>>(cached?.data ?? new Map())
  const [loading, setLoading] = useState(!cached)

  const reload = useCallback(async (force = false) => {
    if (!force && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setClassifications(cached.data)
      return
    }
    setLoading(true)
    try {
      const data = await fetchClassifications()
      cached = { data, timestamp: Date.now() }
      setClassifications(data)
    } catch {
      // Sin clasificaciones no rompe nada visible — los consumidores tratan
      // "sin dato" igual que "sin clasificar".
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  return { classifications, loading, reload: () => reload(true) }
}

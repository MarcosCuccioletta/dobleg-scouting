import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  fetchGpsCatalog, createGpsMetric, addMetricAlias, type NewMetricInput,
} from '@/services/gpsService'
import { buildAliasLookup } from './parser/mapColumns'
import type { GpsMetric, GpsMetricAlias } from './types'

/**
 * Catálogo de métricas + alias, con las mutaciones que usa la carga. Se recarga
 * después de cada alta para que la métrica nueva aparezca al toque en los selectores.
 */
export function useGpsCatalog() {
  const { user, userDisplayName } = useAuth()
  const [metrics, setMetrics] = useState<GpsMetric[]>([])
  const [aliases, setAliases] = useState<GpsMetricAlias[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const catalog = await fetchGpsCatalog()
    setMetrics(catalog.metrics)
    setAliases(catalog.aliases)
    setLoading(false)
  }, [])

  useEffect(() => { void reload() }, [reload])

  const lookup = useMemo(() => buildAliasLookup(metrics, aliases), [metrics, aliases])

  const addMetric = useCallback(async (input: NewMetricInput): Promise<GpsMetric | null> => {
    const created = await createGpsMetric(input, { id: user?.id, name: userDisplayName })
    if (created) await reload()
    return created
  }, [user, userDisplayName, reload])

  /** Recuerda que una cabecera de PDF corresponde a una métrica. */
  const learnAlias = useCallback(async (metricKey: string, header: string, source?: string) => {
    const metric = metrics.find(m => m.key === metricKey)
    if (!metric) return
    await addMetricAlias(metric.id, header, source)
    await reload()
  }, [metrics, reload])

  return { metrics, aliases, lookup, loading, addMetric, learnAlias, reload }
}

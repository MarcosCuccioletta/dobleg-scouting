// src/features/gps/components/HistoryReviewPanel.tsx
import { useMemo, useState } from 'react'
import { saveGpsEntries } from '@/services/gpsService'
import type { GpsMetric, HistoryParseResult } from '../types'
import type { useGpsCatalog } from '../useGpsCatalog'

interface Props {
  result: HistoryParseResult
  playerName: string
  fileName: string
  metrics: GpsMetric[]
  teams: string[]
  competitions: string[]
  defaultEquipo: string
  addMetric: ReturnType<typeof useGpsCatalog>['addMetric']
  onSaved: () => Promise<void>
  onCancel: () => void
}

const IGNORE = '__ignorar__'

interface RowDraft {
  include: boolean
  matchDate: string
  rival: string
  competencia: string
  minutos: string
}

export default function HistoryReviewPanel({
  result, playerName, fileName, metrics, teams, competitions, defaultEquipo,
  addMetric, onSaved, onCancel,
}: Props) {
  const [equipo, setEquipo] = useState(defaultEquipo)
  const [competenciaDefault, setCompetenciaDefault] = useState('')

  const metricColumns = result.columns.filter(c => c.role === 'metric' || c.role === 'unmapped')

  const [mapping, setMapping] = useState<Record<number, string>>(() =>
    Object.fromEntries(metricColumns.map(c => [c.index, c.metricKey ?? IGNORE])))

  const [rows, setRows] = useState<RowDraft[]>(() =>
    result.matches.map(m => ({
      include: true,
      matchDate: m.matchDate ?? '',
      rival: m.rival,
      competencia: m.competencia ?? '',
      minutos: m.minutos === null ? '' : String(m.minutos),
    })))

  const [status, setStatus] = useState<{ kind: 'ok' | 'error' | 'conflict'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const setRow = (i: number, patch: Partial<RowDraft>) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  const changeMapping = async (index: number, value: string) => {
    if (value === '__nova__') {
      const header = result.columns[index].header
      const created = await addMetric({ label: header, unit: '', decimals: 0, category: 'otro' })
      if (created) setMapping(prev => ({ ...prev, [index]: created.key }))
      return
    }
    setMapping(prev => ({ ...prev, [index]: value }))
  }

  const metricByKey = useMemo(() => new Map(metrics.map(m => [m.key, m])), [metrics])

  const savableCount = rows.filter(r => r.include && r.matchDate !== '').length
  const includedMissingDate = rows.filter(r => r.include && r.matchDate === '').length
  const canSave = savableCount > 0

  const save = async () => {
    setSaving(true)
    setStatus(null)

    const entries = rows.flatMap((r, i) => {
      if (!r.include || !r.matchDate) return []
      const match = result.matches[i]
      const metricsPayload: Record<string, number> = {}
      for (const col of metricColumns) {
        const target = mapping[col.index]
        const value = match.values[col.index]
        if (target === IGNORE || value === null || value === undefined) continue
        metricsPayload[target] = value
      }
      return [{
        playerName,
        matchDate: r.matchDate,
        equipo: equipo || null,
        rival: r.rival || null,
        competencia: (r.competencia || competenciaDefault) || null,
        resultado: null,
        minutos: r.minutos === '' ? null : Number(r.minutos),
        metrics: metricsPayload,
        source: 'html' as const,
        fileName,
      }]
    })

    const saveResult = await saveGpsEntries(entries, {})
    setSaving(false)

    if (saveResult.error) { setStatus({ kind: 'error', text: `No se pudo guardar: ${saveResult.error}` }); return }
    if (saveResult.conflicts.length > 0) {
      setStatus({ kind: 'conflict', text: `Ya había cargas para: ${saveResult.conflicts.join(', ')}.` })
      return
    }
    setStatus({ kind: 'ok', text: `Se guardaron ${saveResult.saved} partido(s).` })
    await onSaved()
    onCancel()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-apple-gray-800 dark:text-white">
            Revisá antes de guardar — {playerName}
          </h2>
          <p className="text-xs text-apple-gray-400 truncate">{fileName} · {result.matches.length} partido(s) detectados</p>
        </div>
        <button onClick={onCancel} className="shrink-0 text-sm text-apple-gray-500 underline">Elegir otro archivo</button>
      </div>

      {/* ── Equipo + competencia por defecto ── */}
      <div className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-5 shadow-apple dark:shadow-apple-dark grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1.5">Equipo (todos los partidos)</label>
          <input list="hist-teams" className="w-full px-3 py-2.5 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 bg-white dark:bg-apple-gray-700 text-sm"
            value={equipo} onChange={e => setEquipo(e.target.value)} />
          <datalist id="hist-teams">{teams.map(t => <option key={t} value={t} />)}</datalist>
        </div>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1.5">Competencia por defecto (opcional)</label>
          <input list="hist-comps" className="w-full px-3 py-2.5 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 bg-white dark:bg-apple-gray-700 text-sm"
            placeholder="Se usa solo si el partido no trae la suya" value={competenciaDefault} onChange={e => setCompetenciaDefault(e.target.value)} />
          <datalist id="hist-comps">{competitions.map(c => <option key={c} value={c} />)}</datalist>
        </div>
      </div>

      {/* ── Mapeo de columnas a métricas ── */}
      {metricColumns.length > 0 && (
        <div className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-5 shadow-apple dark:shadow-apple-dark">
          <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">Columnas del archivo</h3>
          <p className="text-xs text-apple-gray-400 mt-0.5 mb-4">Se aplica igual a todos los partidos.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {metricColumns.map(col => (
              <div key={col.index} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: col.role === 'metric' ? '#22C55E' : '#F59E0B' }} />
                <span className="text-sm text-apple-gray-700 dark:text-apple-gray-300 w-32 shrink-0 truncate" title={col.header}>{col.header}</span>
                <select
                  className="flex-1 min-w-0 px-2 py-2 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 bg-white dark:bg-apple-gray-700 text-sm"
                  value={mapping[col.index]} onChange={e => void changeMapping(col.index, e.target.value)}
                >
                  <option value={IGNORE}>Ignorar esta columna</option>
                  <option value="__nueva__">+ Crear métrica "{col.header}"</option>
                  {metrics.filter(m => m.is_active).map(m => (
                    <option key={m.key} value={m.key}>{m.label}{m.unit ? ` (${m.unit})` : ''}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Partidos detectados ── */}
      <div className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-5 shadow-apple dark:shadow-apple-dark">
        <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">Partidos ({result.matches.length})</h3>
        <p className="text-xs text-apple-gray-400 mt-0.5 mb-4">
          La fecha es obligatoria para guardar cada fila. {includedMissingDate > 0 && `Faltan ${includedMissingDate}.`}
        </p>
        <div className="space-y-2">
          {rows.map((r, i) => {
            const match = result.matches[i]
            return (
              <div key={i} className="rounded-apple border border-apple-gray-100 dark:border-apple-gray-700 p-3">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={r.include} onChange={e => setRow(i, { include: e.target.checked })} className="w-5 h-5 accent-brand-green" />
                    {i + 1}
                  </label>
                  <input type="date" className={`px-2 py-1.5 rounded-apple border text-sm ${r.include && !r.matchDate ? 'border-amber-400' : 'border-apple-gray-200 dark:border-apple-gray-600'} bg-white dark:bg-apple-gray-700`}
                    value={r.matchDate} onChange={e => setRow(i, { matchDate: e.target.value })} />
                  <input className="px-2 py-1.5 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 bg-white dark:bg-apple-gray-700 text-sm"
                    placeholder="Rival" value={r.rival} onChange={e => setRow(i, { rival: e.target.value })} />
                  <input className="px-2 py-1.5 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 bg-white dark:bg-apple-gray-700 text-sm"
                    placeholder="Competencia" value={r.competencia} onChange={e => setRow(i, { competencia: e.target.value })} />
                  <input type="number" inputMode="numeric" className="px-2 py-1.5 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 bg-white dark:bg-apple-gray-700 text-sm"
                    placeholder="Minutos" value={r.minutos} onChange={e => setRow(i, { minutos: e.target.value })} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {metricColumns.map(col => {
                    const target = mapping[col.index]
                    const value = match.values[col.index]
                    if (target === IGNORE || value === null || value === undefined) return null
                    const metric = metricByKey.get(target)
                    return (
                      <span key={col.index} className="text-2xs px-2 py-1 rounded-apple bg-apple-gray-50 dark:bg-apple-gray-700/40 text-apple-gray-500">
                        {metric?.label ?? col.header}: <strong className="text-apple-gray-800 dark:text-white">{value}</strong>
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {status && (
        <div className={`rounded-apple px-4 py-3 text-sm ${status.kind === 'ok' ? 'bg-brand-green/10 text-brand-green' : 'bg-red-500/10 text-red-500'}`}>
          {status.text}
        </div>
      )}

      <div className="sticky bottom-20 sm:bottom-0 sm:static">
        <button onClick={() => void save()} disabled={!canSave || saving}
          className="w-full sm:w-auto px-6 py-3 rounded-apple bg-brand-green text-white font-medium disabled:opacity-40">
          {saving ? 'Guardando…' : `Guardar ${savableCount} carga(s)`}
        </button>
      </div>
    </div>
  )
}

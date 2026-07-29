import { useState } from 'react'
import type { GpsMetric, GpsMetricCategory } from '../types'
import type { NewMetricInput } from '@/services/gpsService'

interface Props {
  metrics: GpsMetric[]
  /** key de métrica → valor en texto (vacío = no se carga). */
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
  onAddMetric: (input: NewMetricInput) => Promise<GpsMetric | null>
}

const CATEGORY_LABEL: Record<GpsMetricCategory, string> = {
  locomotor: 'Locomotoras',
  mecanico: 'Mecánicas',
  otro: 'Otras',
}

const field = 'w-full px-3 py-2 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 ' +
  'bg-white dark:bg-apple-gray-700 text-apple-gray-800 dark:text-white text-sm tabular-nums ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-green/40'

export default function MetricValueInputs({ metrics, values, onChange, onAddMetric }: Props) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ label: '', unit: '', decimals: '0', category: 'otro' as GpsMetricCategory })
  const [saving, setSaving] = useState(false)

  const active = metrics.filter(m => m.is_active)
  const groups: GpsMetricCategory[] = ['locomotor', 'mecanico', 'otro']

  const submitNew = async () => {
    if (!draft.label.trim()) return
    setSaving(true)
    const created = await onAddMetric({
      label: draft.label.trim(),
      unit: draft.unit.trim(),
      decimals: Number(draft.decimals) || 0,
      category: draft.category,
    })
    setSaving(false)
    if (created) {
      setDraft({ label: '', unit: '', decimals: '0', category: 'otro' })
      setAdding(false)
    }
  }

  return (
    <div className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-5 shadow-apple dark:shadow-apple-dark">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">Métricas</h3>
          <p className="text-xs text-apple-gray-400 mt-0.5">Completá sólo las que tengas. Las vacías no se guardan.</p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(v => !v)}
          className="shrink-0 px-3 py-2 rounded-apple text-xs font-medium border border-apple-gray-200 dark:border-apple-gray-600 text-apple-gray-600 dark:text-apple-gray-300 hover:border-brand-green/50"
        >
          {adding ? 'Cancelar' : '+ Nueva métrica'}
        </button>
      </div>

      {adding && (
        <div className="mb-5 p-4 rounded-apple bg-apple-gray-50 dark:bg-apple-gray-700/40 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input className={field} placeholder="Nombre (ej. Dist Acele)" value={draft.label}
            onChange={e => setDraft({ ...draft, label: e.target.value })} />
          <input className={field} placeholder="Unidad (m, km/h…)" value={draft.unit}
            onChange={e => setDraft({ ...draft, unit: e.target.value })} />
          <select className={field} value={draft.decimals}
            onChange={e => setDraft({ ...draft, decimals: e.target.value })}>
            <option value="0">Sin decimales</option>
            <option value="1">1 decimal</option>
            <option value="2">2 decimales</option>
          </select>
          <button type="button" onClick={() => void submitNew()} disabled={saving || !draft.label.trim()}
            className="px-4 py-2 rounded-apple bg-brand-green text-white text-sm font-medium disabled:opacity-40">
            {saving ? 'Creando…' : 'Crear'}
          </button>
        </div>
      )}

      {groups.map(group => {
        const list = active.filter(m => m.category === group)
        if (list.length === 0) return null
        return (
          <div key={group} className="mb-5 last:mb-0">
            <div className="text-2xs uppercase tracking-wide text-apple-gray-400 mb-2">{CATEGORY_LABEL[group]}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map(m => (
                <div key={m.key}>
                  <label className="block text-xs text-apple-gray-500 dark:text-apple-gray-400 mb-1" htmlFor={`m-${m.key}`}>
                    {m.label}{m.unit && <span className="text-apple-gray-400"> ({m.unit})</span>}
                  </label>
                  <input
                    id={`m-${m.key}`}
                    type="number"
                    inputMode="decimal"
                    step={m.decimals > 0 ? 0.1 : 1}
                    className={field}
                    value={values[m.key] ?? ''}
                    onChange={e => onChange({ ...values, [m.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

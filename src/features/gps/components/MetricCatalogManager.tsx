import { useState } from 'react'
import { updateGpsMetric, deleteGpsMetric } from '@/services/gpsService'
import type { GpsMetric, GpsMetricCategory } from '../types'

interface Props {
  metrics: GpsMetric[]
  onChanged: () => Promise<void>
}

const CATEGORY_LABEL: Record<GpsMetricCategory, string> = {
  locomotor: 'Locomotora',
  mecanico: 'Mecánica',
  otro: 'Otra',
}

const input = 'px-2 py-1.5 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 ' +
  'bg-white dark:bg-apple-gray-700 text-apple-gray-800 dark:text-white text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-green/40'

interface Draft {
  label: string
  unit: string
  decimals: string
  category: GpsMetricCategory
}

/**
 * Corregir o borrar métricas del catálogo sin tocar la base. Una métrica mal creada
 * (nombre equivocado, el valor cargado en la unidad) se arregla acá; borrar sólo se
 * puede si ninguna carga la usa, para no dejar valores huérfanos.
 */
export default function MetricCatalogManager({ metrics, onChanged }: Props) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft>({ label: '', unit: '', decimals: '0', category: 'otro' })
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const startEdit = (m: GpsMetric) => {
    setNote(null)
    setEditing(m.id)
    setDraft({ label: m.label, unit: m.unit, decimals: String(m.decimals), category: m.category })
  }

  const save = async (m: GpsMetric) => {
    if (!draft.label.trim()) return
    setBusy(true)
    const ok = await updateGpsMetric(m.id, {
      label: draft.label.trim(),
      unit: draft.unit.trim(),
      decimals: Number(draft.decimals) || 0,
      category: draft.category,
    })
    setBusy(false)
    setNote(ok ? `«${draft.label.trim()}» actualizada.` : 'No se pudo guardar.')
    if (ok) { setEditing(null); await onChanged() }
  }

  const remove = async (m: GpsMetric) => {
    if (!window.confirm(`¿Borrar la métrica «${m.label}» del catálogo?`)) return
    setBusy(true)
    const { ok, usedBy } = await deleteGpsMetric(m.id, m.key)
    setBusy(false)
    if (ok) { setNote(`«${m.label}» borrada.`); await onChanged(); return }
    setNote(usedBy > 0
      ? `No se puede borrar «${m.label}»: ${usedBy} carga(s) tienen datos de esa métrica. Borrá primero esas cargas, o corregí el nombre acá.`
      : `No se pudo borrar «${m.label}».`)
  }

  return (
    <div className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-5 shadow-apple dark:shadow-apple-dark">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div>
          <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">
            Catálogo de métricas ({metrics.length})
          </h3>
          <p className="text-xs text-apple-gray-400 mt-0.5">Corregir el nombre o la unidad de una métrica, o borrar una creada por error.</p>
        </div>
        <span className="text-xs text-apple-gray-500 shrink-0">{open ? 'Cerrar' : 'Abrir'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-2">
          {note && (
            <div className="rounded-apple bg-apple-gray-50 dark:bg-apple-gray-700/40 px-3 py-2 text-xs text-apple-gray-600 dark:text-apple-gray-300">
              {note}
            </div>
          )}

          {metrics.map(m => (
            <div key={m.id} className="rounded-apple border border-apple-gray-100 dark:border-apple-gray-700 p-3">
              {editing === m.id ? (
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  <input className={`${input} sm:col-span-2`} value={draft.label}
                    onChange={e => setDraft({ ...draft, label: e.target.value })} placeholder="Nombre" />
                  <input className={input} value={draft.unit}
                    onChange={e => setDraft({ ...draft, unit: e.target.value })} placeholder="Unidad (m, km/h…)" />
                  <select className={input} value={draft.decimals}
                    onChange={e => setDraft({ ...draft, decimals: e.target.value })}>
                    <option value="0">Sin decimales</option>
                    <option value="1">1 decimal</option>
                    <option value="2">2 decimales</option>
                  </select>
                  <select className={input} value={draft.category}
                    onChange={e => setDraft({ ...draft, category: e.target.value as GpsMetricCategory })}>
                    <option value="locomotor">Locomotora</option>
                    <option value="mecanico">Mecánica</option>
                    <option value="otro">Otra</option>
                  </select>
                  <div className="sm:col-span-5 flex gap-2">
                    <button disabled={busy} onClick={() => void save(m)}
                      className="px-4 py-2 rounded-apple bg-brand-green text-white text-sm font-medium disabled:opacity-40">
                      Guardar
                    </button>
                    <button onClick={() => setEditing(null)} className="px-3 py-2 text-sm text-apple-gray-500">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm text-apple-gray-800 dark:text-white truncate">
                      {m.label}
                      {m.unit && <span className="text-apple-gray-400"> ({m.unit})</span>}
                    </div>
                    <div className="text-2xs text-apple-gray-400">
                      {CATEGORY_LABEL[m.category]} · {m.decimals} decimal(es) · clave <code>{m.key}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => startEdit(m)} className="text-xs text-apple-gray-500 underline">Editar</button>
                    <button onClick={() => void remove(m)} className="text-xs text-red-500 underline">Borrar</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

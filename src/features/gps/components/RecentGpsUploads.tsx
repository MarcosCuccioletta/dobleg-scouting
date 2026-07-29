import { useState } from 'react'
import { deleteGpsEntry, updateGpsEntry } from '@/services/gpsService'
import type { GpsEntryRow, GpsMetric } from '../types'

interface Props {
  entries: GpsEntryRow[]
  metrics: GpsMetric[]
  onChanged: () => Promise<void>
}

const LIMIT = 10

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function RecentGpsUploads({ entries, metrics, onChanged }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ rival: string; competencia: string; minutos: string }>({
    rival: '', competencia: '', minutos: '',
  })
  const [busy, setBusy] = useState(false)

  const recent = entries.slice(0, LIMIT)
  const metricCount = (e: GpsEntryRow) => Object.keys(e.metrics ?? {}).length

  const startEdit = (e: GpsEntryRow) => {
    setEditing(e.id)
    setDraft({
      rival: e.rival ?? '',
      competencia: e.competencia ?? '',
      minutos: e.minutos === null ? '' : String(e.minutos),
    })
  }

  const saveEdit = async (id: string) => {
    setBusy(true)
    await updateGpsEntry(id, {
      rival: draft.rival || null,
      competencia: draft.competencia || null,
      minutos: draft.minutos === '' ? null : Number(draft.minutos),
    })
    setBusy(false)
    setEditing(null)
    await onChanged()
  }

  const remove = async (e: GpsEntryRow) => {
    const ok = window.confirm(`¿Borrar la carga de ${e.player_name} del ${formatDate(e.match_date)}?`)
    if (!ok) return
    setBusy(true)
    await deleteGpsEntry(e.id)
    setBusy(false)
    await onChanged()
  }

  if (entries.length === 0) return null

  return (
    <div className="bg-white dark:bg-apple-gray-800 rounded-apple-xl p-5 shadow-apple dark:shadow-apple-dark">
      <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">Últimas cargas</h3>
      <p className="text-xs text-apple-gray-400 mt-0.5 mb-4">
        {entries.length} carga(s) en total · se muestran las {Math.min(LIMIT, entries.length)} más recientes
      </p>

      <div className="space-y-2">
        {recent.map(e => (
          <div key={e.id} className="rounded-apple border border-apple-gray-100 dark:border-apple-gray-700 p-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-medium text-apple-gray-800 dark:text-white truncate">
                  {e.player_name}
                </div>
                <div className="text-xs text-apple-gray-500 dark:text-apple-gray-400">
                  {formatDate(e.match_date)}
                  {e.rival && ` · vs ${e.rival}`}
                  {e.competencia && ` · ${e.competencia}`}
                  {e.minutos !== null && ` · ${e.minutos}'`}
                </div>
                <div className="text-2xs text-apple-gray-400 mt-1">
                  {metricCount(e)} métrica(s) · {e.source === 'pdf' ? `PDF${e.file_name ? `: ${e.file_name}` : ''}` : 'carga manual'}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => startEdit(e)} className="text-xs text-apple-gray-500 underline">Editar</button>
                <button onClick={() => void remove(e)} className="text-xs text-red-500 underline">Borrar</button>
              </div>
            </div>

            {editing === e.id && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input className="px-2 py-2 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 bg-white dark:bg-apple-gray-700 text-sm"
                  placeholder="Rival" value={draft.rival} onChange={ev => setDraft({ ...draft, rival: ev.target.value })} />
                <input className="px-2 py-2 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 bg-white dark:bg-apple-gray-700 text-sm"
                  placeholder="Competencia" value={draft.competencia} onChange={ev => setDraft({ ...draft, competencia: ev.target.value })} />
                <input type="number" inputMode="numeric" className="px-2 py-2 rounded-apple border border-apple-gray-200 dark:border-apple-gray-600 bg-white dark:bg-apple-gray-700 text-sm"
                  placeholder="Minutos" value={draft.minutos} onChange={ev => setDraft({ ...draft, minutos: ev.target.value })} />
                <div className="flex gap-2">
                  <button disabled={busy} onClick={() => void saveEdit(e.id)}
                    className="flex-1 px-3 py-2 rounded-apple bg-brand-green text-white text-sm font-medium disabled:opacity-40">
                    Guardar
                  </button>
                  <button onClick={() => setEditing(null)} className="px-3 py-2 text-sm text-apple-gray-500">Cancelar</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {metrics.length === 0 && (
        <p className="text-xs text-apple-gray-400 mt-3">El catálogo de métricas está vacío: revisá la migración.</p>
      )}
    </div>
  )
}

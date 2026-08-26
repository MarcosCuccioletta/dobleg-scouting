import { useEffect, useState } from 'react'
import { fetchNotesFor, addNoteTo } from '@/services/marketService'
import { useAuth } from '@/context/AuthContext'
import type { MarketNote } from '@/types/market'

export default function MarketNotesPanel({
  target,
  onFollowupSynced,
}: {
  target: { negotiationId?: number; needId?: number }
  onFollowupSynced?: (date: string) => void
}) {
  const { user, userDisplayName } = useAuth()
  const [notes, setNotes] = useState<MarketNote[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [isMeeting, setIsMeeting] = useState(false)
  const [followup, setFollowup] = useState('')
  const [saving, setSaving] = useState(false)

  const targetKey = target.negotiationId ?? target.needId

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchNotesFor(target).then(data => { if (active) setNotes(data) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey])

  const handleAdd = async () => {
    if (!body.trim()) return
    setSaving(true)
    const note = await addNoteTo(target, body.trim(), isMeeting, followup || null, user?.id ?? null, userDisplayName || 'Usuario')
    setSaving(false)
    if (note) {
      setNotes(prev => [note, ...prev])
      setBody('')
      setIsMeeting(false)
      if (followup) {
        onFollowupSynced?.(followup)
        setFollowup('')
      }
    }
  }

  const meetingCount = notes.filter(n => n.is_meeting).length

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-apple-gray-500 uppercase tracking-wider">
        Notas{meetingCount > 0 && ` · ${meetingCount} reunión${meetingCount !== 1 ? 'es' : ''}`}
      </p>

      <div className="space-y-2">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Escribir una nota..."
          rows={2}
          className="input-apple text-sm w-full resize-none"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-apple-gray-500 cursor-pointer">
            <input type="checkbox" checked={isMeeting} onChange={e => setIsMeeting(e.target.checked)} className="rounded" />
            Fue una reunión
          </label>
          <input
            type="date"
            value={followup}
            onChange={e => setFollowup(e.target.value)}
            title="Volver a hablar el..."
            className="input-apple text-xs py-1 w-auto"
          />
          <button
            onClick={handleAdd}
            disabled={!body.trim() || saving}
            className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-green hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? 'Guardando...' : 'Agregar'}
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-xs text-apple-gray-400">Cargando notas...</p>
        ) : notes.length === 0 ? (
          <p className="text-xs text-apple-gray-400">Todavía no hay notas.</p>
        ) : (
          notes.map(n => (
            <div
              key={n.id}
              className={`text-xs p-2.5 rounded-lg bg-apple-gray-50 dark:bg-apple-gray-800/50 ${n.is_system ? 'italic text-apple-gray-400' : 'text-apple-gray-700 dark:text-apple-gray-200'}`}
            >
              <div className="flex items-center justify-between mb-0.5 gap-2">
                <span className="font-medium truncate">{n.author_name || 'Sistema'}{n.is_meeting && ' · 🤝 Reunión'}</span>
                <span className="text-apple-gray-400 flex-shrink-0">{new Date(n.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</span>
              </div>
              <p>{n.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

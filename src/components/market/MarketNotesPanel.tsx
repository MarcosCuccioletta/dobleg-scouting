import { useEffect, useState } from 'react'
import { fetchNotesFor, addNoteTo } from '@/services/marketService'
import { isValidFollowupDate } from '@/utils/marketAlerts'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { LANGUAGE_LOCALES } from '@/constants/translations'
import type { MarketNote } from '@/types/market'

export default function MarketNotesPanel({
  target,
  onFollowupSynced,
  refreshSignal,
}: {
  target: { negotiationId?: number; needId?: number }
  onFollowupSynced?: (date: string) => void
  /** Incrementar desde el padre para forzar un refetch (ej. después de una
   * reasignación, que inserta una nota de sistema fuera de este componente). */
  refreshSignal?: number
}) {
  const { user, userDisplayName } = useAuth()
  const { t, language } = useLanguage()
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
  }, [targetKey, refreshSignal])

  const handleAdd = async () => {
    if (!body.trim()) return
    const validFollowup = followup && isValidFollowupDate(followup) ? followup : null
    setSaving(true)
    const note = await addNoteTo(target, body.trim(), isMeeting, validFollowup, user?.id ?? null, userDisplayName || 'Usuario')
    setSaving(false)
    if (note) {
      setNotes(prev => [note, ...prev])
      setBody('')
      setIsMeeting(false)
      if (validFollowup) {
        onFollowupSynced?.(validFollowup)
        setFollowup('')
      }
    }
  }

  const meetingCount = notes.filter(n => n.is_meeting).length

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-apple-gray-500 uppercase tracking-wider">
        {t('mercado.notas')}{meetingCount > 0 && ` · ${meetingCount} ${meetingCount !== 1 ? t('mercado.reunionPlural') : t('mercado.reunionSingular')}`}
      </p>

      <div className="space-y-2">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={t('mercado.escribirNota')}
          rows={2}
          className="input-apple text-sm w-full resize-none"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-apple-gray-500 cursor-pointer">
            <input type="checkbox" checked={isMeeting} onChange={e => setIsMeeting(e.target.checked)} className="rounded" />
            {t('mercado.fueReunion')}
          </label>
          <input
            type="date"
            value={followup}
            onChange={e => setFollowup(e.target.value)}
            title={t('mercado.volverAHablar')}
            min="2020-01-01"
            max="2100-12-31"
            className="input-apple text-xs py-1 w-auto"
          />
          <button
            onClick={handleAdd}
            disabled={!body.trim() || saving}
            className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-green hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? t('mercado.guardando') : t('mercado.agregar')}
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-xs text-apple-gray-400">{t('mercado.cargandoNotas')}</p>
        ) : notes.length === 0 ? (
          <p className="text-xs text-apple-gray-400">{t('mercado.sinNotas')}</p>
        ) : (
          notes.map(n => (
            <div
              key={n.id}
              className={`text-xs p-2.5 rounded-lg bg-apple-gray-50 dark:bg-apple-gray-800/50 ${n.is_system ? 'italic text-apple-gray-400' : 'text-apple-gray-700 dark:text-apple-gray-200'}`}
            >
              <div className="flex items-center justify-between mb-0.5 gap-2">
                <span className="font-medium truncate">{n.author_name || t('mercado.sistema')}{n.is_meeting && ` · 🤝 ${t('mercado.reunionSingular')}`}</span>
                <span className="text-apple-gray-400 flex-shrink-0">{new Date(n.created_at).toLocaleDateString(LANGUAGE_LOCALES[language], { day: '2-digit', month: 'short' })}</span>
              </div>
              <p>{n.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

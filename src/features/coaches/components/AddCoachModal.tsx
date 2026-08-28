import { useState } from 'react'
import { createAgencyCoach } from '@/services/agencyCoachesService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import { normalizeForSearch } from '@/lib/search'

function slugify(name: string): string {
  return normalizeForSearch(name).replace(/\s+/g, '-')
}

export default function AddCoachModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (coach: AgencyCoach) => void
}) {
  const [fullName, setFullName] = useState('')
  const [club, setClub] = useState('')
  const [relationship, setRelationship] = useState<'propio' | 'intermediado'>('propio')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!fullName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const coach = await createAgencyCoach({
        key: slugify(fullName),
        fullName: fullName.trim(),
        photo: null,
        club: club.trim() || null,
        relationship,
      })
      onCreated(coach)
    } catch {
      setError('No se pudo guardar. Probá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-apple-gray-900 rounded-apple-lg p-6 w-full max-w-sm space-y-4">
        <h3 className="text-base font-semibold text-apple-gray-800 dark:text-white">Agregar entrenador</h3>
        <input
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Nombre completo"
          className="w-full px-3 py-2.5 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-apple-gray-800 dark:text-white text-sm"
        />
        <input
          value={club}
          onChange={e => setClub(e.target.value)}
          placeholder="Club actual (opcional)"
          className="w-full px-3 py-2.5 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-apple-gray-800 dark:text-white text-sm"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRelationship('propio')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium ${relationship === 'propio' ? 'bg-brand-green text-apple-gray-900' : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-700 dark:text-apple-gray-300'}`}
          >
            Cliente propio
          </button>
          <button
            type="button"
            onClick={() => setRelationship('intermediado')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium ${relationship === 'intermediado' ? 'bg-brand-green text-apple-gray-900' : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-700 dark:text-apple-gray-300'}`}
          >
            Intermediado
          </button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-apple-gray-500 dark:text-apple-gray-400">Cancelar</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!fullName.trim() || saving}
            className="px-4 py-2 rounded-xl bg-brand-green text-apple-gray-900 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { listAgencyCoaches } from '@/services/agencyCoachesService'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import AddCoachModal from '@/features/coaches/components/AddCoachModal'
import { parseWyscoutTeamStatsXlsx } from '@/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats'
import type { WyscoutMatch } from '@/features/coaches/wyscoutTeamStats/parseWyscoutTeamStats'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function Step1CoachYArchivo({
  onNext,
}: {
  onNext: (coach: AgencyCoach, matches: WyscoutMatch[]) => void
}) {
  const [coaches, setCoaches] = useState<AgencyCoach[] | null>(null)
  const [selected, setSelected] = useState<AgencyCoach | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listAgencyCoaches().then(setCoaches)
  }, [])

  const handleFile = async (file: File) => {
    if (!selected) return
    setError(null)
    setParsing(true)
    try {
      const buffer = await file.arrayBuffer()
      const matches = await parseWyscoutTeamStatsXlsx(buffer, selected.club ?? selected.fullName)
      if (matches.length === 0) {
        setError('No se encontraron partidos de este equipo en el archivo. Revisá que sea el export "Team Stats" correcto.')
        return
      }
      onNext(selected, matches)
    } catch {
      setError('No se pudo leer el archivo. Tiene que ser el export "Team Stats" de Wyscout (.xlsx).')
    } finally {
      setParsing(false)
    }
  }

  if (coaches === null) return <LoadingSpinner message="Cargando entrenadores..." />

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-3">Elegí el entrenador</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {coaches.map(coach => (
            <button
              key={coach.key}
              type="button"
              onClick={() => setSelected(coach)}
              className={`flex items-center gap-3 p-3 rounded-xl border text-left ${
                selected?.key === coach.key
                  ? 'border-brand-green bg-brand-green/5'
                  : 'border-apple-gray-200 dark:border-apple-gray-700'
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-apple-gray-800 dark:text-white truncate">{coach.fullName}</p>
                <p className="text-xs text-apple-gray-400">{coach.club ?? 'Sin club'}</p>
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="p-3 rounded-xl border border-dashed border-apple-gray-300 dark:border-apple-gray-600 text-sm text-apple-gray-500"
          >
            + Agregar entrenador
          </button>
        </div>
      </div>

      {selected && (
        <div>
          <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-2">
            Subí el export "Team Stats" de Wyscout de {selected.club ?? selected.fullName}
          </h3>
          <input
            type="file"
            accept=".xlsx"
            disabled={parsing}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="text-sm"
          />
          {parsing && <p className="text-xs text-apple-gray-400 mt-2">Procesando archivo...</p>}
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      )}

      {showAdd && (
        <AddCoachModal
          onClose={() => setShowAdd(false)}
          onCreated={coach => {
            setCoaches(prev => (prev ? [...prev, coach] : [coach]))
            setSelected(coach)
            setShowAdd(false)
          }}
        />
      )}
    </div>
  )
}

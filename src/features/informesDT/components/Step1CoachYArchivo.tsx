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
  const [teamName, setTeamName] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // listAgencyCoaches() puede devolver null si falla la carga (ver
    // agencyCoachesService.listAgencyCoaches): acá no hace falta un estado de
    // error dedicado, alcanza con tratarlo como "todavía no hay entrenadores".
    listAgencyCoaches().then(list => setCoaches(list ?? []))
  }, [])

  const handleFile = async (file: File) => {
    if (!selected || !teamName.trim()) return
    setError(null)
    setParsing(true)
    try {
      const buffer = await file.arrayBuffer()
      const matches = await parseWyscoutTeamStatsXlsx(buffer, teamName.trim())
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
              disabled={parsing}
              onClick={() => {
                setError(null)
                setSelected(coach)
                setTeamName(coach.club ?? '')
              }}
              className={`flex items-center gap-3 p-3 rounded-xl border text-left disabled:opacity-50 disabled:cursor-not-allowed ${
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
            Nombre del equipo en Wyscout
          </h3>
          <input
            type="text"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            placeholder="Ej: Temperley"
            disabled={parsing}
            className="w-full px-3 py-2 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm mb-1"
          />
          <p className="text-xs text-apple-gray-400 mb-4">
            Tiene que coincidir con el nombre del equipo tal cual aparece en el archivo de Wyscout
            (puede ser distinto al club del entrenador, sobre todo si está sin club).
          </p>

          <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-2">
            Subí el export "Team Stats" de Wyscout
          </h3>
          <input
            type="file"
            accept=".xlsx"
            disabled={parsing || !teamName.trim()}
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
            setTeamName(coach.club ?? '')
            setShowAdd(false)
          }}
        />
      )}
    </div>
  )
}

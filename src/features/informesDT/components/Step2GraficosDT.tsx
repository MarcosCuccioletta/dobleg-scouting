import type { RadarAxisKey, EvolutionChartKey } from '../types'

const RADAR_OPTIONS: { key: RadarAxisKey; label: string }[] = [
  { key: 'posesion', label: 'Posesión' },
  { key: 'duelos', label: 'Duelos ganados' },
  { key: 'duelosAereos', label: 'Duelos aéreos' },
  { key: 'precisionPase', label: 'Precisión de pase' },
  { key: 'xg', label: 'xG por partido' },
  { key: 'ppda', label: 'PPDA (presión)' },
]

const EVOLUTION_OPTIONS: { key: EvolutionChartKey; label: string }[] = [
  { key: 'posesion', label: 'Evolución de posesión' },
  { key: 'xg', label: 'Evolución de xG' },
  { key: 'duelos', label: 'Evolución de duelos' },
  { key: 'duelosAereos', label: 'Evolución de duelos aéreos' },
  { key: 'ppda', label: 'Evolución de PPDA' },
]

function toggle<T>(list: T[], key: T): T[] {
  return list.includes(key) ? list.filter(k => k !== key) : [...list, key]
}

export default function Step2GraficosDT({
  radarAxes,
  evolutionCharts,
  onChange,
  onBack,
  onNext,
}: {
  radarAxes: RadarAxisKey[]
  evolutionCharts: EvolutionChartKey[]
  onChange: (radarAxes: RadarAxisKey[], evolutionCharts: EvolutionChartKey[]) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-1">
          Radar de perfil táctico
        </h3>
        <p className="text-xs text-apple-gray-400 mb-3">Elegí hasta 6 ejes, o ninguno para sacar el radar del informe.</p>
        <div className="flex flex-wrap gap-2">
          {RADAR_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(toggle(radarAxes, opt.key), evolutionCharts)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                radarAxes.includes(opt.key)
                  ? 'bg-brand-green text-apple-gray-900'
                  : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-1">
          Gráficos de evolución partido a partido
        </h3>
        <p className="text-xs text-apple-gray-400 mb-3">Elegí cuáles incluir, o ninguno.</p>
        <div className="flex flex-wrap gap-2">
          {EVOLUTION_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(radarAxes, toggle(evolutionCharts, opt.key))}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                evolutionCharts.includes(opt.key)
                  ? 'bg-brand-green text-apple-gray-900'
                  : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="px-4 py-2 text-sm text-apple-gray-500">Atrás</button>
        <button type="button" onClick={onNext} className="px-4 py-2 rounded-xl bg-brand-green text-apple-gray-900 text-sm font-semibold">
          Siguiente
        </button>
      </div>
    </div>
  )
}

import { useMemo } from 'react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import type { EnrichedPlayer, NormalizedPlayer } from '@/types'
import { RADAR_METRICS, METRIC_ABBREVIATIONS, POSITION_MAP } from '@/constants/scoring'
import { normalizeName, computePositionMinMax } from '@/utils/scoring'

interface ComparisonViewProps {
  players: EnrichedPlayer[]
  allNormalized: NormalizedPlayer[]
  allPlayers: EnrichedPlayer[]
}

const PLAYER_COLORS = ['#22C55E', '#3B82F6', '#F59E0B']

function getVal(player: EnrichedPlayer, metric: string): number {
  const v = player[metric]
  if (typeof v === 'number') return v
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

function pctDiff(a: number, b: number): string {
  if (a === 0) return '—'
  const diff = ((b - a) / Math.abs(a)) * 100
  return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`
}

function getNormalized(
  player: EnrichedPlayer,
  allNormalized: NormalizedPlayer[],
  allPlayers: EnrichedPlayer[],
  metrics: string[]
): Record<string, number> {
  const found = allNormalized.find(n => normalizeName(n.Jugador) === normalizeName(player.Jugador))
  if (found) {
    return Object.fromEntries(metrics.map(m => [m, ((found[m] as number) ?? 0) * 100]))
  }
  const posKey = POSITION_MAP[player['Posición']?.trim() ?? ''] ?? ''
  const minMax = computePositionMinMax(allPlayers, posKey, metrics)
  return Object.fromEntries(metrics.map(m => {
    const raw = getVal(player, m)
    const { min, max } = minMax[m] ?? { min: 0, max: 1 }
    return [m, max > min ? ((raw - min) / (max - min)) * 100 : 50]
  }))
}

function getComparisonStats(players: EnrichedPlayer[]): string[] {
  const base = players[0]
  if (!base) return []
  return [
    'Partidos jugados', 'Minutos jugados', 'Goles', 'Asistencias', 'xG', 'xA',
    'Duelos ganados %', 'Duelos defensivos ganados %', 'Duelos aéreos ganados %',
    'Interceptaciones/90', 'Pases progresivos exitosos/90', 'Pases hacia adelante/90',
    'Precisión pases largos %', 'Carreras en progresión/90',
    'Gambetas completadas/90', 'Duelos atacantes ganados/90',
    'xA/90', 'Jugadas claves/90', 'Toques en el área de penalti/90',
    'Acciones de ataque exitosas/90', 'Ataque en profundidad/90',
    'Centros precisos/90', 'Remates/90',
  ].filter(m => base[m] !== undefined && base[m] !== '')
}

export default function ComparisonView({ players, allNormalized, allPlayers }: ComparisonViewProps) {
  const posKey = POSITION_MAP[players[0]?.['Posición']?.trim() ?? ''] ?? 'Defensor Central'
  const radarMetrics = RADAR_METRICS[posKey] ?? RADAR_METRICS['Defensor Central']
  const statsToCompare = useMemo(() => getComparisonStats(players), [players])

  const radarData = useMemo(() => {
    const normalizedValues = players.map(p => getNormalized(p, allNormalized, allPlayers, radarMetrics))
    return radarMetrics.map(metric => {
      const point: Record<string, unknown> = {
        subject: METRIC_ABBREVIATIONS[metric] ?? metric,
        fullMetric: metric,
        fullMark: 100,
      }
      players.forEach((p, i) => {
        point[`p${i}`] = Math.round(normalizedValues[i][metric] ?? 0)
      })
      return point
    })
  }, [players, allNormalized, allPlayers, radarMetrics])

  return (
    <div className="space-y-6">
      {/* Player headers */}
      <div className={`grid gap-4 ${players.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {players.map((player, i) => (
          <div
            key={player.Jugador}
            className="p-5 card-apple border-l-4 transition-all"
            style={{ borderLeftColor: PLAYER_COLORS[i] }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: PLAYER_COLORS[i] }}
              >
                {player.Jugador.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </div>
              <h3 className="font-bold text-apple-gray-800 dark:text-white text-sm truncate">
                {player.Jugador}
              </h3>
            </div>
            <div className="text-xs text-apple-gray-500 dark:text-apple-gray-400 space-y-1">
              <p>{player.Equipo || '—'} · {player['Posición'] || '—'}</p>
              <p>Edad: {player.Edad} · {player.marketValueFormatted}</p>
              <p className="font-semibold text-sm mt-2" style={{ color: PLAYER_COLORS[i] }}>
                Score GG: {player.ggScore?.toFixed(1) ?? '—'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Radar charts */}
      <div className="card-apple p-5">
        <h4 className="text-sm font-semibold text-apple-gray-700 dark:text-apple-gray-300 mb-5">
          Comparación Radar — {posKey}
        </h4>
        <ResponsiveContainer width="100%" height={360}>
          <RadarChart data={radarData} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
            <PolarGrid stroke="#6E6E73" strokeOpacity={0.3} />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fontSize: 11, fill: '#86868B' }}
              tickLine={false}
            />
            {players.map((player, i) => (
              <Radar
                key={player.Jugador}
                name={player.Jugador.split(' ').pop() ?? player.Jugador}
                dataKey={`p${i}`}
                stroke={PLAYER_COLORS[i]}
                fill={PLAYER_COLORS[i]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(29, 29, 31, 0.95)',
                border: '1px solid rgba(110, 110, 115, 0.3)',
                borderRadius: '12px',
                fontSize: '12px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
              }}
              formatter={(v: number, name: string) => [v, name]}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
              formatter={(v) => <span style={{ color: '#86868B' }}>{v}</span>}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Stats comparison - Visual cards */}
      <div className="card-apple overflow-hidden">
        <div className="px-5 py-4 border-b border-apple-gray-200/50 dark:border-apple-gray-700/50 bg-apple-gray-50 dark:bg-apple-gray-800/50">
          <h4 className="text-sm font-semibold text-apple-gray-700 dark:text-apple-gray-300">
            Métricas comparadas
          </h4>
          <p className="text-xs text-apple-gray-500 mt-0.5">
            El jugador con mejor valor en cada métrica se resalta
          </p>
        </div>
        <div className="p-4 space-y-3">
          {statsToCompare.map(metric => {
            const values = players.map(p => getVal(p, metric))
            const maxVal = Math.max(...values)
            const minVal = Math.min(...values)
            const range = maxVal - minVal || 1

            return (
              <div key={metric} className="bg-apple-gray-50 dark:bg-apple-gray-800/50 rounded-xl p-4">
                <div className="text-xs text-apple-gray-500 dark:text-apple-gray-400 mb-3 font-medium">
                  {metric}
                </div>
                <div className={`grid gap-3 ${players.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {values.map((v, i) => {
                    const isWinner = v === maxVal && values.filter(x => x === maxVal).length === 1
                    const barWidth = maxVal > 0 ? (v / maxVal) * 100 : 0

                    return (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-2xs font-medium text-apple-gray-500 dark:text-apple-gray-400">
                            {players[i].Jugador.split(' ').pop()}
                          </span>
                          {isWinner && (
                            <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: PLAYER_COLORS[i] + '20', color: PLAYER_COLORS[i] }}>
                              MEJOR
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-apple-gray-200 dark:bg-apple-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: isWinner ? PLAYER_COLORS[i] : PLAYER_COLORS[i] + '60'
                              }}
                            />
                          </div>
                          <span
                            className={`text-sm font-bold tabular-nums min-w-[50px] text-right ${isWinner ? '' : 'text-apple-gray-600 dark:text-apple-gray-400'}`}
                            style={isWinner ? { color: PLAYER_COLORS[i] } : {}}
                          >
                            {v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Difference indicator for 2 players */}
                {players.length === 2 && values[0] !== values[1] && (
                  <div className="mt-3 pt-3 border-t border-apple-gray-200/50 dark:border-apple-gray-700/50 flex items-center justify-center gap-2">
                    <span className="text-2xs text-apple-gray-400">Diferencia:</span>
                    <span className={`text-xs font-bold ${
                      values[1] > values[0] ? 'text-blue-500' : 'text-emerald-500'
                    }`}>
                      {players[values[1] > values[0] ? 1 : 0].Jugador.split(' ').pop()} {pctDiff(Math.min(...values), Math.max(...values))}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="px-5 py-4 border-t border-apple-gray-200/50 dark:border-apple-gray-700/50 bg-apple-gray-50/50 dark:bg-apple-gray-800/30">
          <div className="flex items-center justify-center gap-6">
            {players.map((p, i) => {
              const wins = statsToCompare.filter(metric => {
                const values = players.map(pl => getVal(pl, metric))
                const maxVal = Math.max(...values)
                return getVal(p, metric) === maxVal && values.filter(x => x === maxVal).length === 1
              }).length
              return (
                <div key={p.Jugador} className="text-center">
                  <div
                    className="text-2xl font-bold"
                    style={{ color: PLAYER_COLORS[i] }}
                  >
                    {wins}
                  </div>
                  <div className="text-2xs text-apple-gray-500 dark:text-apple-gray-400">
                    métricas ganadas por {p.Jugador.split(' ').pop()}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

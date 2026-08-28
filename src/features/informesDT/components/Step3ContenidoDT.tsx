import type { InformeDTContent, ComparativaMetric, TituloJugador } from '../types'
import { TROPHY_CATALOG } from '../trophyCatalog'

function updateComparativaValue(
  comparativa: ComparativaMetric[],
  key: string,
  field: 'ownValue' | 'rivalValue',
  value: number,
): ComparativaMetric[] {
  return comparativa.map(m => (m.key === key ? { ...m, [field]: value, overridden: true } : m))
}

export default function Step3ContenidoDT({
  content,
  onChange,
  onBack,
  onNext,
}: {
  content: InformeDTContent
  onChange: (content: InformeDTContent) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-3">Identidad</h3>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={content.nombre}
            onChange={e => onChange({ ...content, nombre: e.target.value })}
            placeholder="Nombre"
            className="px-3 py-2 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm"
          />
          <input
            value={content.sistemaHabitual}
            onChange={e => onChange({ ...content, sistemaHabitual: e.target.value })}
            placeholder="Sistema habitual (ej. 4-2-3-1)"
            className="px-3 py-2 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm"
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white mb-1">
          Comparativa vs. rival promedio
        </h3>
        <p className="text-xs text-apple-gray-400 mb-3">
          Los valores salen del archivo de Wyscout. Si alguno está mal, corregilo acá — queda marcado como editado a mano.
        </p>
        <div className="space-y-2">
          {content.comparativa.map(metric => (
            <div key={metric.key} className="flex items-center gap-3">
              <span className="text-xs text-apple-gray-500 flex-1">{metric.label}</span>
              <input
                type="number"
                step="0.01"
                value={metric.ownValue}
                onChange={e =>
                  onChange({
                    ...content,
                    comparativa: updateComparativaValue(content.comparativa, metric.key, 'ownValue', Number(e.target.value)),
                  })
                }
                className="w-20 px-2 py-1 rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm text-right"
              />
              <span className="text-2xs text-apple-gray-400">vs</span>
              <input
                type="number"
                step="0.01"
                value={metric.rivalValue}
                onChange={e =>
                  onChange({
                    ...content,
                    comparativa: updateComparativaValue(content.comparativa, metric.key, 'rivalValue', Number(e.target.value)),
                  })
                }
                className="w-20 px-2 py-1 rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm text-right"
              />
              {metric.overridden && <span className="text-2xs text-amber-500">editado</span>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={content.experienciaJugador.incluir}
            onChange={e =>
              onChange({
                ...content,
                experienciaJugador: { ...content.experienciaJugador, incluir: e.target.checked },
              })
            }
          />
          <h3 className="text-sm font-semibold text-apple-gray-800 dark:text-white">
            Incluir "Experiencia como jugador"
          </h3>
        </div>
        {content.experienciaJugador.incluir && (
          <div className="space-y-3 pl-6">
            <div className="grid grid-cols-2 gap-3">
              <input
                value={content.experienciaJugador.edad}
                onChange={e =>
                  onChange({ ...content, experienciaJugador: { ...content.experienciaJugador, edad: e.target.value } })
                }
                placeholder="Edad"
                className="px-3 py-2 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm"
              />
              <input
                value={content.experienciaJugador.posicion}
                onChange={e =>
                  onChange({ ...content, experienciaJugador: { ...content.experienciaJugador, posicion: e.target.value } })
                }
                placeholder="Posición habitual"
                className="px-3 py-2 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm"
              />
            </div>
            <div>
              <p className="text-xs text-apple-gray-400 mb-2">Títulos como jugador</p>
              {content.experienciaJugador.titulos.map((t, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 mb-2">
                  <input
                    value={t.nombre}
                    onChange={e => {
                      const titulos = [...content.experienciaJugador.titulos]
                      titulos[i] = { ...t, nombre: e.target.value }
                      onChange({ ...content, experienciaJugador: { ...content.experienciaJugador, titulos } })
                    }}
                    placeholder="Nombre del título"
                    className="flex-1 min-w-[140px] px-2 py-1 rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm"
                  />
                  <input
                    value={t.temporada}
                    onChange={e => {
                      const titulos = [...content.experienciaJugador.titulos]
                      titulos[i] = { ...t, temporada: e.target.value }
                      onChange({ ...content, experienciaJugador: { ...content.experienciaJugador, titulos } })
                    }}
                    placeholder="Temporada (ej. 16/17)"
                    className="w-32 px-2 py-1 rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm"
                  />
                  <input
                    value={t.club}
                    onChange={e => {
                      const titulos = [...content.experienciaJugador.titulos]
                      titulos[i] = { ...t, club: e.target.value }
                      onChange({ ...content, experienciaJugador: { ...content.experienciaJugador, titulos } })
                    }}
                    placeholder="Club (ej. CA Independiente)"
                    className="flex-1 min-w-[140px] px-2 py-1 rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm"
                  />
                  <select
                    value={t.trofeoKey}
                    onChange={e => {
                      const titulos = [...content.experienciaJugador.titulos]
                      titulos[i] = { ...t, trofeoKey: e.target.value }
                      onChange({ ...content, experienciaJugador: { ...content.experienciaJugador, titulos } })
                    }}
                    className="px-2 py-1 rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-transparent text-sm"
                  >
                    {TROPHY_CATALOG.map(trophy => (
                      <option key={trophy.key} value={trophy.key}>{trophy.label}</option>
                    ))}
                  </select>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const nuevo: TituloJugador = { nombre: '', temporada: '', club: '', trofeoKey: 'generico' }
                  onChange({
                    ...content,
                    experienciaJugador: {
                      ...content.experienciaJugador,
                      titulos: [...content.experienciaJugador.titulos, nuevo],
                    },
                  })
                }}
                className="text-xs text-brand-green font-medium"
              >
                + Agregar título
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="px-4 py-2 text-sm text-apple-gray-500">Atrás</button>
        <button type="button" onClick={onNext} className="px-4 py-2 rounded-xl bg-brand-green text-apple-gray-900 text-sm font-semibold">
          Siguiente
        </button>
      </div>
    </div>
  )
}

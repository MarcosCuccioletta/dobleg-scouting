import type { Informe, InformeContent, MatchRow, Comparable, ContinuityOverrides, ContinuityKey } from '@/features/informes/types'
import { useInformeEnrichment } from '@/features/informes/useInformeEnrichment'
import {
  autoContinuityValues,
  defaultContinuityLabel,
  isContinuityTileHidden,
  CONTINUITY_DEFS,
} from '@/features/informes/continuity'
import { editableLast5, EMPTY_MATCH_ROW } from '@/features/informes/last5'
import Step3Impacto from './Step3Impacto'

// ─── Helpers ────────────────────────────────────────────────────────────────

const EMPTY_COMPARABLE: Comparable = { jugador: '', club: '', rating: '', delta: '' }

/** Al menos 3 filas vacías para arrancar si no hay comparables cargados. */
function displayComparables(rows: Comparable[]): Comparable[] {
  return rows.length > 0 ? rows : [{ ...EMPTY_COMPARABLE }, { ...EMPTY_COMPARABLE }, { ...EMPTY_COMPARABLE }]
}

// ─── UI primitives ──────────────────────────────────────────────────────────

const cardClass = 'rounded-2xl border border-apple-gray-200 dark:border-apple-gray-800 bg-white dark:bg-apple-gray-900 p-5'
const labelClass = 'block text-xs uppercase tracking-wide text-apple-gray-500 dark:text-apple-gray-400 mb-1'
const inputClass = 'w-full px-3 py-2 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 bg-apple-gray-50 dark:bg-apple-gray-800 text-apple-gray-900 dark:text-white placeholder-apple-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green text-sm'
const smallInputClass = 'w-full px-2 py-1.5 rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-apple-gray-50 dark:bg-apple-gray-800 text-apple-gray-900 dark:text-white placeholder-apple-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green text-xs'

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

function Field({ label, value, onChange, placeholder }: FieldProps) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  )
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-apple-gray-700 dark:text-apple-gray-200 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="rounded border-apple-gray-300 dark:border-apple-gray-600 text-brand-green focus:ring-brand-green/40"
      />
      {label}
    </label>
  )
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface Step3ContenidoProps {
  informe: Informe
  content: InformeContent
  onChange: (content: InformeContent) => void
  onChangeInforme: (informe: Informe) => void
  onBack: () => void
  onNext: () => void
}

export default function Step3Contenido({ informe, content, onChange, onChangeInforme, onBack, onNext }: Step3ContenidoProps) {
  const set = <K extends keyof InformeContent>(key: K, value: InformeContent[K]) =>
    onChange({ ...content, [key]: value })

  // Continuidad de la pestaña General: se muestra lo que trae la API como
  // placeholder y el usuario escribe encima si no le cierra (la API cuenta sólo
  // los partidos que tiene cargados).
  const lang = informe.idioma ?? 'es'
  const enrichment = useInformeEnrichment(informe)
  const autoCont = autoContinuityValues(enrichment.continuity)
  const cont: ContinuityOverrides = content.continuidad ?? {}
  const patchCont = (patch: Partial<ContinuityOverrides>) =>
    onChange({ ...content, continuidad: { ...cont, ...patch } })
  const setCont = (key: ContinuityKey, value: string) => patchCont({ [key]: value })
  const setContLabel = (key: ContinuityKey, value: string) =>
    patchCont({ labels: { ...cont.labels, [key]: value } })
  const toggleCont = (key: ContinuityKey) => {
    const hidden = cont.hidden ?? []
    const wasHidden = isContinuityTileHidden(cont, key)
    const next = wasHidden ? hidden.filter(k => k !== key) : [...hidden, key]
    // El valor "-" era la forma vieja de ocultar: al volver a mostrarla se limpia.
    patchCont(wasHidden ? { hidden: next, [key]: '' } : { hidden: next })
  }

  // Últimos 5: arranca con lo que trae la API para que se vea cuál falta. En
  // cuanto el usuario toca algo, la lista pasa a ser suya (queda guardada).
  const apiLast5 = enrichment.last5
  const matches = editableLast5(content.ultimos5, apiLast5)
  const usandoApi = (content.ultimos5?.length ?? 0) === 0
  const setMatches = (rows: MatchRow[]) => onChange({ ...content, ultimos5: rows })
  function updateMatch(idx: number, patch: Partial<MatchRow>) {
    setMatches(matches.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  function addMatch() {
    setMatches([{ ...EMPTY_MATCH_ROW }, ...matches])
  }
  function removeMatch(idx: number) {
    setMatches(matches.filter((_, i) => i !== idx))
  }
  function resetMatches() {
    setMatches([])
  }

  const comparables = displayComparables(content.comparables)
  function updateComparable(idx: number, patch: Partial<Comparable>) {
    onChange({ ...content, comparables: comparables.map((r, i) => (i === idx ? { ...r, ...patch } : r)) })
  }
  function addComparable() {
    onChange({ ...content, comparables: [...comparables, { ...EMPTY_COMPARABLE }] })
  }
  function removeComparable(idx: number) {
    onChange({ ...content, comparables: comparables.filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Izquierda ── */}
        <div className="space-y-4">
          <div className={cardClass}>
            <h2 className="text-sm font-semibold text-apple-gray-900 dark:text-white mb-3">Datos del jugador</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre" value={content.nombre} onChange={v => set('nombre', v)} />
              <Field label="Club" value={content.club} onChange={v => set('club', v)} />
              <Field label="Posición" value={content.posicion} onChange={v => set('posicion', v)} />
              <Field label="Rol" value={content.rol} onChange={v => set('rol', v)} />
              <Field label="Edad" value={content.edad} onChange={v => set('edad', v)} />
              <Field label="Nacionalidad" value={content.nacionalidad} onChange={v => set('nacionalidad', v)} />
              <Field label="Liga" value={content.liga} onChange={v => set('liga', v)} />
              <Field label="Contrato" value={content.contrato} onChange={v => set('contrato', v)} />
              <div className="col-span-2">
                <Field label="Valor de mercado" value={content.valorMercado} onChange={v => set('valorMercado', v)} />
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-apple-gray-900 dark:text-white">Estadísticas principales</h2>
              <CheckboxField label="Ocultar en el email" checked={content.hideMainStats} onChange={v => set('hideMainStats', v)} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Rating" value={content.rating} onChange={v => set('rating', v)} />
              <Field label="PJ" value={content.pj} onChange={v => set('pj', v)} />
              <Field label="Minutos" value={content.minutos} onChange={v => set('minutos', v)} />
              <Field label="Goles" value={content.goles} onChange={v => set('goles', v)} />
              <Field label="Asistencias" value={content.asistencias} onChange={v => set('asistencias', v)} />
              <Field label="Prom. rating (opc.)" value={content.ratingPromedio ?? ''} onChange={v => set('ratingPromedio', v)} placeholder="marca del gauge" />
            </div>
            <div className="mt-3 space-y-2">
              <CheckboxField
                label="No mostrar el rating (Score GG) en este informe"
                checked={content.hideRating ?? false}
                onChange={v => set('hideRating', v)}
              />
              <CheckboxField
                label="Sacar la pestaña Físico del informe"
                checked={content.hideFisicoTab ?? false}
                onChange={v => set('hideFisicoTab', v)}
              />
              <CheckboxField
                label="Físico: mostrar sólo los datos (sin gráficos)"
                checked={content.hideFisicoCharts ?? false}
                onChange={v => set('hideFisicoCharts', v)}
              />
              <CheckboxField
                label="Sacar la pestaña Carrera del informe"
                checked={content.hideCarreraTab ?? false}
                onChange={v => set('hideCarreraTab', v)}
              />
              <CheckboxField
                label="Sacar la pestaña Comparaciones del informe"
                checked={content.hideComparacionesTab ?? false}
                onChange={v => set('hideComparacionesTab', v)}
              />
              <p className="text-[11px] text-apple-gray-500 dark:text-apple-gray-400">
                Comparaciones ya no aparece sola: si no cargaste comparación de jugadores, comparables ni notas, la pestaña no se genera.
              </p>
            </div>
          </div>

          {/* ── Pestaña General del informe ── */}
          <div className={cardClass}>
            <h2 className="text-sm font-semibold text-apple-gray-900 dark:text-white mb-3">Pestaña General</h2>
            <div className="space-y-2">
              <CheckboxField
                label="Ocultar Evolución de nivel (Score GG) y su “Cómo leerlo”"
                checked={content.hideLevelEvo ?? false}
                onChange={v => set('hideLevelEvo', v)}
              />
              <CheckboxField
                label="Ocultar Continuidad"
                checked={content.hideContinuity ?? false}
                onChange={v => set('hideContinuity', v)}
              />
            </div>
            {!content.hideContinuity && (
              <>
                <div className="mt-3 space-y-2">
                  <div className="hidden sm:grid grid-cols-[auto_1fr_1fr] gap-2 px-1">
                    <span className="w-4" />
                    <span className={labelClass}>Título de la tarjeta</span>
                    <span className={labelClass}>Valor</span>
                  </div>
                  {CONTINUITY_DEFS.map(({ key }) => {
                    const shown = !isContinuityTileHidden(cont, key)
                    return (
                      <div key={key} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
                        <input
                          type="checkbox"
                          checked={shown}
                          onChange={() => toggleCont(key)}
                          title="Mostrar esta tarjeta"
                          className="rounded border-apple-gray-300 dark:border-apple-gray-600 text-brand-green focus:ring-brand-green/40"
                        />
                        <input
                          type="text"
                          value={cont.labels?.[key] ?? ''}
                          onChange={e => setContLabel(key, e.target.value)}
                          placeholder={defaultContinuityLabel(key, lang)}
                          disabled={!shown}
                          className={`${smallInputClass} disabled:opacity-40`}
                        />
                        <input
                          type="text"
                          value={cont[key] ?? ''}
                          onChange={e => setCont(key, e.target.value)}
                          placeholder={autoCont[key] || 'auto'}
                          disabled={!shown}
                          className={`${smallInputClass} disabled:opacity-40`}
                        />
                      </div>
                    )
                  })}
                </div>
                <p className="text-[11px] text-apple-gray-500 dark:text-apple-gray-400 mt-2">
                  Destildá la tarjeta que no quieras (ej. Titularidades). Vacío = lo que trae la API (el texto gris); escribí encima lo que quieras, título y valor.
                </p>
              </>
            )}
          </div>

          <div className={cardClass}>
            <h2 className="text-sm font-semibold text-apple-gray-900 dark:text-white mb-3">Links y carrera</h2>
            <div className="space-y-3">
              <Field label="Video (URL de YouTube)" value={content.videoUrl} onChange={v => set('videoUrl', v)} placeholder="https://youtube.com/..." />
              <Field label="Transfermarkt" value={content.transfermarktUrl} onChange={v => set('transfermarktUrl', v)} placeholder="https://transfermarkt.com/..." />
              <Field label="Agencia" value={content.representante} onChange={v => set('representante', v)} />
            </div>
          </div>
        </div>

        {/* ── Derecha ── */}
        <div className="space-y-4">
          <div className={cardClass}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h2 className="text-sm font-semibold text-apple-gray-900 dark:text-white">Últimos 5 partidos</h2>
              <div className="flex items-center gap-2">
                {!usandoApi && apiLast5.length > 0 && (
                  <button type="button" onClick={resetMatches} className="text-xs font-semibold text-apple-gray-500 dark:text-apple-gray-400 hover:underline">
                    Volver a los de la API
                  </button>
                )}
                <button type="button" onClick={addMatch} className="px-2.5 py-1 rounded-lg border border-brand-green text-brand-green text-xs font-semibold">
                  + Agregar partido
                </button>
              </div>
            </div>
            <p className="text-[11px] text-apple-gray-500 dark:text-apple-gray-400 mb-3">
              {usandoApi
                ? 'Estos son los que trae la API. Editá lo que quieras o agregá el partido que falta: el primero de la lista es el más reciente.'
                : 'Lista propia: se publica tal cual la dejes, de arriba (más reciente) hacia abajo.'}
            </p>
            <div className="space-y-3 sm:space-y-2">
              {/* La fila de encabezados sólo tiene sentido con las columnas completas:
                  en celular se apila y cada campo lleva su propio placeholder. */}
              <div className="hidden sm:grid grid-cols-[64px_1fr_1fr_1fr_1fr_auto] gap-2 px-1">
                <span className={labelClass}>Fecha</span>
                <span className={labelClass}>Rival</span>
                <span className={labelClass}>Resultado</span>
                <span className={labelClass}>Rating</span>
                <span className={labelClass}>Minutos</span>
                <span />
              </div>
              {matches.length === 0 && (
                <p className="text-xs text-apple-gray-500 dark:text-apple-gray-400">
                  Sin partidos. Tocá “Agregar partido” para cargarlos a mano.
                </p>
              )}
              {matches.map((row, idx) => (
                <div key={idx} className="grid grid-cols-2 sm:grid-cols-[64px_1fr_1fr_1fr_1fr_auto] gap-2">
                  <input type="text" placeholder="dd/mm" value={row.fecha ?? ''} onChange={e => updateMatch(idx, { fecha: e.target.value })} className={smallInputClass} />
                  <input type="text" placeholder="Rival" value={row.rival} onChange={e => updateMatch(idx, { rival: e.target.value })} className={smallInputClass} />
                  <input type="text" placeholder="Resultado" value={row.resultado} onChange={e => updateMatch(idx, { resultado: e.target.value })} className={smallInputClass} />
                  <input type="text" placeholder="Rating" value={row.rating} onChange={e => updateMatch(idx, { rating: e.target.value })} className={smallInputClass} />
                  <input type="text" placeholder="Minutos" value={row.minutos} onChange={e => updateMatch(idx, { minutos: e.target.value })} className={smallInputClass} />
                  <button
                    type="button"
                    onClick={() => removeMatch(idx)}
                    title="Borrar este partido"
                    aria-label="Borrar este partido"
                    className="px-2 py-1.5 rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 text-apple-gray-400 hover:text-red-500 hover:border-red-400 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-apple-gray-500 dark:text-apple-gray-400 mt-2">
              La fecha es sólo para que los reconozcas acá; en el informe se publican rival, resultado, rating y minutos. El resultado se escribe con los goles de su equipo primero (ej. 2-1) para que el color salga bien.
            </p>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-apple-gray-900 dark:text-white">Comparables</h2>
              <CheckboxField label="Ocultar comparables" checked={content.hideComparables} onChange={v => set('hideComparables', v)} />
            </div>
            <div className="space-y-3 sm:space-y-2">
              <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 px-1">
                <span className={labelClass}>Jugador</span>
                <span className={labelClass}>Club</span>
                <span className={labelClass}>Rating</span>
                <span className={labelClass}>Delta</span>
                <span />
              </div>
              {comparables.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center border-b sm:border-0 border-apple-gray-100 dark:border-apple-gray-800 pb-3 sm:pb-0 last:border-0"
                >
                  <input type="text" placeholder="Jugador" value={row.jugador} onChange={e => updateComparable(idx, { jugador: e.target.value })} className={smallInputClass} />
                  <input type="text" placeholder="Club" value={row.club} onChange={e => updateComparable(idx, { club: e.target.value })} className={smallInputClass} />
                  {/* En celular la X va al final de la primera fila; en desktop, al final de la única fila. */}
                  <button
                    type="button"
                    onClick={() => removeComparable(idx)}
                    aria-label="Quitar comparable"
                    className="sm:order-last text-apple-gray-400 hover:text-brand-green transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <input type="text" placeholder="Rating" value={row.rating} onChange={e => updateComparable(idx, { rating: e.target.value })} className={smallInputClass} />
                  <input type="text" placeholder="Delta" value={row.delta} onChange={e => updateComparable(idx, { delta: e.target.value })} className={smallInputClass} />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addComparable}
              className="mt-3 w-full py-2 rounded-xl text-xs font-medium border-2 border-dashed border-apple-gray-300 dark:border-apple-gray-600 text-apple-gray-500 dark:text-apple-gray-400 hover:border-brand-green hover:text-brand-green transition-all"
            >
              + Agregar comparable
            </button>
          </div>

          <div className={cardClass}>
            <label className={labelClass}>Comparaciones</label>
            <textarea
              value={content.comparaciones}
              onChange={e => set('comparaciones', e.target.value)}
              rows={4}
              placeholder="Notas de comparación adicionales..."
              className={`${inputClass} resize-y mt-1`}
            />
          </div>

          <Step3Impacto informe={informe} onChange={onChangeInforme} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-4 py-3 rounded-xl bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-700 dark:text-apple-gray-200 text-sm font-semibold hover:bg-apple-gray-200 dark:hover:bg-apple-gray-700 transition-colors"
        >
          ← Volver
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 px-4 py-3 rounded-xl bg-brand-green text-white text-sm font-semibold hover:bg-brand-green/90 transition-colors"
        >
          Preview del informe →
        </button>
      </div>
    </div>
  )
}

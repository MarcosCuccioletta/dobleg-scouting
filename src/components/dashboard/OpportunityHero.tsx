import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRecentForm } from '@/hooks/usePlayerStats'
import { useData } from '@/context/DataContext'
import { excludeAgencyPlayers } from '@/utils/agencyFilter'
import { marketTagsFor, topByPosition, OPPORTUNITY_POSITIONS } from '@/utils/opportunities'
import { displayPosition, type Position } from '@/types/scoring'
import Sparkline from '@/components/ui/Sparkline'

const CHEAP_MAX = 5_000_000, CONTRACT_MAX = 12
const TAG_LABEL = { contract: 'Fin de contrato', cheap: 'Precio bajo' } as const

export default function OpportunityHero() {
  const navigate = useNavigate()
  const { players: allPlayers, loading } = useRecentForm({
    windowMonths: 3, cheapMaxValue: CHEAP_MAX, contractMaxMonths: CONTRACT_MAX, limit: 200,
  })
  // Un jugador que ya representamos no es una oportunidad de mercado.
  const { agencyPlayers } = useData()
  const players = useMemo(
    () => excludeAgencyPlayers(allPlayers, agencyPlayers),
    [allPlayers, agencyPlayers],
  )
  const grouped = useMemo(() => topByPosition(players, OPPORTUNITY_POSITIONS, 8), [players])

  const [activePos, setActivePos] = useState<Position>(OPPORTUNITY_POSITIONS[0])
  const [userSelected, setUserSelected] = useState(false)

  // Por defecto arranca en la primera posición con candidatos. Una vez que el
  // usuario toca una pestaña, no la volvemos a mover por debajo suyo.
  useEffect(() => {
    if (userSelected || loading) return
    const firstNonEmpty = OPPORTUNITY_POSITIONS.find(pos => grouped[pos].length > 0)
    if (firstNonEmpty) setActivePos(firstNonEmpty)
  }, [grouped, loading, userSelected])

  const activePlayers = grouped[activePos] ?? []

  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = () => {
    const el = scrollerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    scrollerRef.current?.scrollTo({ left: 0 })
    // El scroll no dispara 'scroll' al resetearse por cambio de posición, así que recalculamos a mano.
    requestAnimationFrame(updateScrollState)
  }, [activePos, activePlayers.length])

  useEffect(() => {
    window.addEventListener('resize', updateScrollState)
    return () => window.removeEventListener('resize', updateScrollState)
  }, [])

  const scrollByPage = (direction: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  if (loading || players.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-apple-gray-800 dark:text-white">
          Oportunidades de mercado
        </h2>
        <Link
          to="/oportunidades"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-green hover:text-emerald-600 transition-colors"
        >
          Ver más oportunidades
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-thin">
        {OPPORTUNITY_POSITIONS.map(pos => (
          <button
            key={pos}
            onClick={() => { setUserSelected(true); setActivePos(pos) }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
              pos === activePos
                ? 'bg-brand-green text-apple-gray-900'
                : 'bg-apple-gray-100 dark:bg-apple-gray-800 text-apple-gray-500 dark:text-apple-gray-400 hover:bg-apple-gray-200 dark:hover:bg-apple-gray-700 hover:text-apple-gray-700 dark:hover:text-apple-gray-200'}`}
          >
            {displayPosition(pos)}
          </button>
        ))}
      </div>

      {activePlayers.length === 0 ? (
        <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-5 text-sm text-apple-gray-400">
          Sin oportunidades por ahora en {displayPosition(activePos)}.
        </div>
      ) : (
        <div className="relative group/carousel">
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollByPage(-1)}
              aria-label="Ver anteriores"
              className="hidden sm:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-white/95 dark:bg-apple-gray-800/95 backdrop-blur border border-apple-gray-200/70 dark:border-apple-gray-700/60 shadow-apple-md text-apple-gray-500 dark:text-apple-gray-400 hover:text-brand-green hover:border-brand-green/50 hover:scale-105 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          <div
            ref={scrollerRef}
            onScroll={updateScrollState}
            className="flex gap-3 overflow-x-auto scrollbar-none scroll-smooth snap-x snap-proximity pb-1"
          >
            {activePlayers.map(p => {
              const tags = marketTagsFor(p, { cheapMaxValue: CHEAP_MAX, contractMaxMonths: CONTRACT_MAX })
              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/jugador/${encodeURIComponent(p.name)}?source=externo&apiId=${p.id}`)}
                  className="cursor-pointer snap-start flex-shrink-0 w-64 bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4 hover:shadow-apple-md hover:border-brand-green/40 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    {p.photo
                      ? <img src={p.photo} alt="" className="w-12 h-12 rounded-full object-cover" />
                      : <div className="w-12 h-12 rounded-full bg-apple-gray-200 dark:bg-apple-gray-700" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-apple-gray-800 dark:text-white truncate">{p.name}</h3>
                        {p.on_the_rise && <span className="text-brand-green text-xs font-semibold flex-shrink-0">▲</span>}
                      </div>
                      <p className="text-xs text-apple-gray-500 truncate">
                        {[p.team?.name, p.league_name].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map(t => (
                        <span key={t} className="text-2xs font-medium px-1.5 py-0.5 rounded-full bg-brand-green/10 text-brand-green">{TAG_LABEL[t]}</span>
                      ))}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-brand-green tabular-nums leading-none">{p.recent_avg.toFixed(1)}</p>
                      <p className="text-2xs text-apple-gray-400">{p.recent_matches} PJ</p>
                    </div>
                  </div>
                  <div className="mt-1.5 flex justify-end"><Sparkline values={p.recent_scores} /></div>
                </div>
              )
            })}
          </div>

          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollByPage(1)}
              aria-label="Ver siguientes"
              className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-white/95 dark:bg-apple-gray-800/95 backdrop-blur border border-apple-gray-200/70 dark:border-apple-gray-700/60 shadow-apple-md text-apple-gray-500 dark:text-apple-gray-400 hover:text-brand-green hover:border-brand-green/50 hover:scale-105 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      )}
    </section>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchClubNeeds, fetchNegotiations, fetchTeamMembers } from '@/services/marketService'
import { computeAlerts, type AlertableItem } from '@/utils/marketAlerts'
import { NEGOTIATION_STATUS_LABEL_KEY } from '@/components/market/marketLabels'
import NegotiationRow from '@/components/market/NegotiationRow'
import NeedRow from '@/components/market/NeedRow'
import NewNegotiationForm from '@/components/market/NewNegotiationForm'
import NewNeedForm from '@/components/market/NewNeedForm'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { useLanguage } from '@/context/LanguageContext'
import type { ClubNeed, Negotiation, NegotiationStatus, NeedStatus, TeamMember } from '@/types/market'

type Tab = 'negociaciones' | 'objetivos'

export default function MarketPage() {
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const highlight = searchParams.get('highlight')
  const [highlightKind, highlightIdStr] = highlight?.split('-') ?? []
  const highlightId = highlightIdStr ? Number(highlightIdStr) : null
  const [tab, setTab] = useState<Tab>(highlightKind === 'need' ? 'objetivos' : 'negociaciones')
  const [negotiations, setNegotiations] = useState<Negotiation[]>([])
  const [needs, setNeeds] = useState<ClubNeed[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  const [clubFilter, setClubFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState<number | 'all'>('all')
  const [negotiationStatusFilter, setNegotiationStatusFilter] = useState<NegotiationStatus | 'all'>('all')
  const [needStatusFilter, setNeedStatusFilter] = useState<NeedStatus | 'all'>('all')

  const [showNewNegotiation, setShowNewNegotiation] = useState(false)
  const [showNewNeed, setShowNewNeed] = useState(false)

  const loadData = () => {
    setLoading(true)
    Promise.all([fetchNegotiations(), fetchClubNeeds(), fetchTeamMembers()])
      .then(([n, c, m]) => { setNegotiations(n); setNeeds(c); setMembers(m) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const overdueIds = useMemo(() => {
    const items: AlertableItem[] = [
      ...negotiations.map(n => ({ id: n.id, kind: 'negotiation' as const, status: n.status, assigned_to_id: n.assigned_to_id, next_followup_date: n.next_followup_date })),
      ...needs.map(n => ({ id: n.id, kind: 'need' as const, status: n.status, assigned_to_id: n.assigned_to_id, next_followup_date: n.next_followup_date })),
    ]
    const alerts = computeAlerts(items, new Date())
    return {
      negotiations: new Set(alerts.filter(a => a.kind === 'negotiation' && a.urgency === 'vencido').map(a => a.id)),
      needs: new Set(alerts.filter(a => a.kind === 'need' && a.urgency === 'vencido').map(a => a.id)),
    }
  }, [negotiations, needs])

  const visibleNegotiations = useMemo(() => negotiations.filter(n => {
    const clubText = clubFilter.trim().toLowerCase()
    if (clubText && !(n.team_name?.toLowerCase().includes(clubText) || n.current_team_name?.toLowerCase().includes(clubText))) return false
    if (assigneeFilter !== 'all' && n.assigned_to_id !== assigneeFilter) return false
    if (negotiationStatusFilter !== 'all' && n.status !== negotiationStatusFilter) return false
    if (onlyOverdue && !overdueIds.negotiations.has(n.id)) return false
    return true
  }), [negotiations, clubFilter, assigneeFilter, negotiationStatusFilter, onlyOverdue, overdueIds])

  const visibleNeeds = useMemo(() => needs.filter(n => {
    if (clubFilter.trim() && !n.team_name.toLowerCase().includes(clubFilter.trim().toLowerCase())) return false
    if (assigneeFilter !== 'all' && n.assigned_to_id !== assigneeFilter) return false
    if (needStatusFilter !== 'all' && n.status !== needStatusFilter) return false
    if (onlyOverdue && !overdueIds.needs.has(n.id)) return false
    return true
  }), [needs, clubFilter, assigneeFilter, needStatusFilter, onlyOverdue, overdueIds])

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-apple-gray-800 dark:text-white tracking-tight">{t('mercado.titulo')}</h1>
          <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400 mt-0.5">{t('mercado.subtitulo')}</p>
        </div>
        <button
          onClick={() => (tab === 'negociaciones' ? setShowNewNegotiation(true) : setShowNewNeed(true))}
          className="flex items-center gap-2 px-3.5 py-2 bg-brand-green text-white rounded-xl font-semibold text-sm hover:bg-emerald-600 active:scale-95 transition-all shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          {tab === 'negociaciones' ? t('mercado.nuevaNegociacion') : t('mercado.nuevoObjetivo')}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-1.5 bg-apple-gray-100 dark:bg-apple-gray-800 rounded-xl p-1">
          <button
            onClick={() => setTab('negociaciones')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'negociaciones' ? 'bg-white dark:bg-apple-gray-700 text-apple-gray-800 dark:text-white shadow-sm' : 'text-apple-gray-500 dark:text-apple-gray-400'}`}
          >
            {t('mercado.tabNegociaciones')} ({negotiations.length})
          </button>
          <button
            onClick={() => setTab('objetivos')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'objetivos' ? 'bg-white dark:bg-apple-gray-700 text-apple-gray-800 dark:text-white shadow-sm' : 'text-apple-gray-500 dark:text-apple-gray-400'}`}
          >
            {t('mercado.tabObjetivos')} ({needs.length})
          </button>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-apple-gray-500 dark:text-apple-gray-400 cursor-pointer">
          <input type="checkbox" checked={onlyOverdue} onChange={e => setOnlyOverdue(e.target.checked)} className="rounded" />
          {t('mercado.soloVencidos')}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <input
          type="text"
          value={clubFilter}
          onChange={e => setClubFilter(e.target.value)}
          placeholder={t('mercado.filtrarClub')}
          className="input-apple text-sm w-full sm:w-48"
        />
        <select
          value={assigneeFilter}
          onChange={e => setAssigneeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="input-apple text-sm w-auto min-w-0"
        >
          <option value="all">{t('mercado.todosResponsables')}</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        {tab === 'negociaciones' ? (
          <select
            value={negotiationStatusFilter}
            onChange={e => setNegotiationStatusFilter(e.target.value as NegotiationStatus | 'all')}
            className="input-apple text-sm w-auto min-w-0"
          >
            <option value="all">{t('mercado.todosEstados')}</option>
            {(Object.keys(NEGOTIATION_STATUS_LABEL_KEY) as NegotiationStatus[]).map(s => (
              <option key={s} value={s}>{t(NEGOTIATION_STATUS_LABEL_KEY[s])}</option>
            ))}
          </select>
        ) : (
          <select
            value={needStatusFilter}
            onChange={e => setNeedStatusFilter(e.target.value as NeedStatus | 'all')}
            className="input-apple text-sm w-auto min-w-0"
          >
            <option value="all">{t('mercado.todosEstados')}</option>
            <option value="abierto">{t('mercado.estadoAbierto')}</option>
            <option value="cerrado">{t('mercado.estadoCerrado')}</option>
          </select>
        )}
      </div>

      {loading ? (
        <LoadingSpinner message={t('mercado.cargando')} />
      ) : tab === 'negociaciones' ? (
        visibleNegotiations.length === 0 ? (
          <EmptyState
            title={t('mercado.sinNegociacionesTitulo')}
            description={negotiations.length === 0 ? t('mercado.sinNegociacionesVacio') : t('mercado.sinNegociacionesFiltro')}
          />
        ) : (
          <div className="space-y-2">
            {visibleNegotiations.map(n => (
              <NegotiationRow
                key={n.id}
                negotiation={n}
                defaultExpanded={highlightKind === 'negotiation' && n.id === highlightId}
                onUpdated={updated => setNegotiations(prev => prev.map(x => x.id === updated.id ? updated : x))}
              />
            ))}
          </div>
        )
      ) : visibleNeeds.length === 0 ? (
        <EmptyState
          title={t('mercado.sinObjetivosTitulo')}
          description={needs.length === 0 ? t('mercado.sinObjetivosVacio') : t('mercado.sinObjetivosFiltro')}
        />
      ) : (
        <div className="space-y-2">
          {visibleNeeds.map(n => (
            <NeedRow
              key={n.id}
              need={n}
              defaultExpanded={highlightKind === 'need' && n.id === highlightId}
              onUpdated={updated => setNeeds(prev => prev.map(x => x.id === updated.id ? updated : x))}
            />
          ))}
        </div>
      )}

      <NewNegotiationForm
        open={showNewNegotiation}
        onClose={() => setShowNewNegotiation(false)}
        onCreated={n => setNegotiations(prev => [n, ...prev])}
      />
      <NewNeedForm
        open={showNewNeed}
        onClose={() => setShowNewNeed(false)}
        onCreated={n => setNeeds(prev => [n, ...prev])}
      />
    </div>
  )
}

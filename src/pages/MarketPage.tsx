import { useEffect, useMemo, useState } from 'react'
import { fetchClubNeeds, fetchNegotiations, fetchTeamMembers } from '@/services/marketService'
import { computeAlerts, type AlertableItem, type MarketAlert } from '@/utils/marketAlerts'
import AlertsStrip from '@/components/market/AlertsStrip'
import NegotiationCard, { NEGOTIATION_STATUS_LABEL } from '@/components/market/NegotiationCard'
import NeedCard from '@/components/market/NeedCard'
import NewNegotiationForm from '@/components/market/NewNegotiationForm'
import NewNeedForm from '@/components/market/NewNeedForm'
import NegotiationDetailSheet from '@/components/market/NegotiationDetailSheet'
import NeedDetailSheet from '@/components/market/NeedDetailSheet'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import type { ClubNeed, Negotiation, NegotiationStatus, NeedStatus, TeamMember } from '@/types/market'

type Tab = 'negociaciones' | 'objetivos'

export default function MarketPage() {
  const [tab, setTab] = useState<Tab>('negociaciones')
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
  const [selectedNegotiation, setSelectedNegotiation] = useState<Negotiation | null>(null)
  const [selectedNeed, setSelectedNeed] = useState<ClubNeed | null>(null)

  const loadData = () => {
    setLoading(true)
    Promise.all([fetchNegotiations(), fetchClubNeeds(), fetchTeamMembers()])
      .then(([n, c, m]) => { setNegotiations(n); setNeeds(c); setMembers(m) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const alerts = useMemo<MarketAlert[]>(() => {
    const items: AlertableItem[] = [
      ...negotiations.map(n => ({ id: n.id, kind: 'negotiation' as const, status: n.status, assigned_to_id: n.assigned_to_id, next_followup_date: n.next_followup_date })),
      ...needs.map(n => ({ id: n.id, kind: 'need' as const, status: n.status, assigned_to_id: n.assigned_to_id, next_followup_date: n.next_followup_date })),
    ]
    return computeAlerts(items, new Date())
  }, [negotiations, needs])

  const overdueNegotiationIds = useMemo(
    () => new Set(alerts.filter(a => a.kind === 'negotiation' && a.urgency === 'vencido').map(a => a.id)),
    [alerts],
  )
  const overdueNeedIds = useMemo(
    () => new Set(alerts.filter(a => a.kind === 'need' && a.urgency === 'vencido').map(a => a.id)),
    [alerts],
  )

  const visibleNegotiations = useMemo(() => negotiations.filter(n => {
    if (clubFilter.trim() && !n.team_name.toLowerCase().includes(clubFilter.trim().toLowerCase())) return false
    if (assigneeFilter !== 'all' && n.assigned_to_id !== assigneeFilter) return false
    if (negotiationStatusFilter !== 'all' && n.status !== negotiationStatusFilter) return false
    if (onlyOverdue && !overdueNegotiationIds.has(n.id)) return false
    return true
  }), [negotiations, clubFilter, assigneeFilter, negotiationStatusFilter, onlyOverdue, overdueNegotiationIds])

  const visibleNeeds = useMemo(() => needs.filter(n => {
    if (clubFilter.trim() && !n.team_name.toLowerCase().includes(clubFilter.trim().toLowerCase())) return false
    if (assigneeFilter !== 'all' && n.assigned_to_id !== assigneeFilter) return false
    if (needStatusFilter !== 'all' && n.status !== needStatusFilter) return false
    if (onlyOverdue && !overdueNeedIds.has(n.id)) return false
    return true
  }), [needs, clubFilter, assigneeFilter, needStatusFilter, onlyOverdue, overdueNeedIds])

  const handleSelectAlert = (alert: MarketAlert) => {
    if (alert.kind === 'negotiation') {
      const n = negotiations.find(x => x.id === alert.id)
      if (n) { setTab('negociaciones'); setSelectedNegotiation(n) }
    } else {
      const n = needs.find(x => x.id === alert.id)
      if (n) { setTab('objetivos'); setSelectedNeed(n) }
    }
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-apple-gray-800 dark:text-white tracking-tight">Mercado</h1>
          <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400 mt-0.5">Negociaciones y objetivos con clubes</p>
        </div>
        <button
          onClick={() => (tab === 'negociaciones' ? setShowNewNegotiation(true) : setShowNewNeed(true))}
          className="flex items-center gap-2 px-3.5 py-2 bg-brand-green text-white rounded-xl font-semibold text-sm hover:bg-emerald-600 active:scale-95 transition-all shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          {tab === 'negociaciones' ? 'Nueva negociación' : 'Nuevo objetivo'}
        </button>
      </div>

      <AlertsStrip alerts={alerts} onSelectAlert={handleSelectAlert} />

      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-1.5 bg-apple-gray-100 dark:bg-apple-gray-800 rounded-xl p-1">
          <button
            onClick={() => setTab('negociaciones')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'negociaciones' ? 'bg-white dark:bg-apple-gray-700 text-apple-gray-800 dark:text-white shadow-sm' : 'text-apple-gray-500 dark:text-apple-gray-400'}`}
          >
            Negociaciones ({negotiations.length})
          </button>
          <button
            onClick={() => setTab('objetivos')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'objetivos' ? 'bg-white dark:bg-apple-gray-700 text-apple-gray-800 dark:text-white shadow-sm' : 'text-apple-gray-500 dark:text-apple-gray-400'}`}
          >
            Objetivos ({needs.length})
          </button>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-apple-gray-500 dark:text-apple-gray-400 cursor-pointer">
          <input type="checkbox" checked={onlyOverdue} onChange={e => setOnlyOverdue(e.target.checked)} className="rounded" />
          Solo vencidos
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <input
          type="text"
          value={clubFilter}
          onChange={e => setClubFilter(e.target.value)}
          placeholder="Filtrar por club..."
          className="input-apple text-sm w-full sm:w-48"
        />
        <select
          value={assigneeFilter}
          onChange={e => setAssigneeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="input-apple text-sm"
        >
          <option value="all">Todos los responsables</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        {tab === 'negociaciones' ? (
          <select
            value={negotiationStatusFilter}
            onChange={e => setNegotiationStatusFilter(e.target.value as NegotiationStatus | 'all')}
            className="input-apple text-sm"
          >
            <option value="all">Todos los estados</option>
            {(Object.keys(NEGOTIATION_STATUS_LABEL) as NegotiationStatus[]).map(s => (
              <option key={s} value={s}>{NEGOTIATION_STATUS_LABEL[s]}</option>
            ))}
          </select>
        ) : (
          <select
            value={needStatusFilter}
            onChange={e => setNeedStatusFilter(e.target.value as NeedStatus | 'all')}
            className="input-apple text-sm"
          >
            <option value="all">Todos los estados</option>
            <option value="abierto">Abierto</option>
            <option value="cerrado">Cerrado</option>
          </select>
        )}
      </div>

      {loading ? (
        <LoadingSpinner message="Cargando Mercado..." />
      ) : tab === 'negociaciones' ? (
        visibleNegotiations.length === 0 ? (
          <EmptyState
            title="Sin negociaciones"
            description={negotiations.length === 0 ? 'Todavía no hay negociaciones cargadas.' : 'No hay negociaciones vencidas.'}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleNegotiations.map(n => (
              <NegotiationCard key={n.id} negotiation={n} onClick={() => setSelectedNegotiation(n)} />
            ))}
          </div>
        )
      ) : visibleNeeds.length === 0 ? (
        <EmptyState
          title="Sin objetivos"
          description={needs.length === 0 ? 'Todavía no hay objetivos cargados.' : 'No hay objetivos vencidos.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleNeeds.map(n => (
            <NeedCard key={n.id} need={n} onClick={() => setSelectedNeed(n)} />
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
      <NegotiationDetailSheet
        negotiation={selectedNegotiation}
        open={selectedNegotiation != null}
        onClose={() => setSelectedNegotiation(null)}
        onUpdated={n => {
          setNegotiations(prev => prev.map(x => x.id === n.id ? n : x))
          setSelectedNegotiation(n)
        }}
      />
      <NeedDetailSheet
        need={selectedNeed}
        open={selectedNeed != null}
        onClose={() => setSelectedNeed(null)}
        onUpdated={n => {
          setNeeds(prev => prev.map(x => x.id === n.id ? n : x))
          setSelectedNeed(n)
        }}
      />
    </div>
  )
}

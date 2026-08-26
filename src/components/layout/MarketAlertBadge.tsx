import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchClubNeeds, fetchNegotiations, fetchTeamMembers } from '@/services/marketService'
import { computeAlerts, type AlertableItem } from '@/utils/marketAlerts'
import { useAuth } from '@/context/AuthContext'

// Vive en el Navbar, montado en TODAS las paginas de la app — sin cache, cada
// navegacion dispararia 3 queries a Supabase solo para el numerito de la
// campanita. Cache en memoria de 60s.
let cachedCount: { value: number; timestamp: number } | null = null
const CACHE_TTL_MS = 60_000

export default function MarketAlertBadge() {
  const { userDisplayName } = useAuth()
  const navigate = useNavigate()
  const [count, setCount] = useState(cachedCount?.value ?? 0)

  useEffect(() => {
    if (cachedCount && Date.now() - cachedCount.timestamp < CACHE_TTL_MS) {
      setCount(cachedCount.value)
      return
    }
    Promise.all([fetchClubNeeds(), fetchNegotiations(), fetchTeamMembers()])
      .then(([needs, negotiations, members]) => {
        const items: AlertableItem[] = [
          ...needs.map(n => ({ id: n.id, kind: 'need' as const, status: n.status, assigned_to_id: n.assigned_to_id, next_followup_date: n.next_followup_date })),
          ...negotiations.map(n => ({ id: n.id, kind: 'negotiation' as const, status: n.status, assigned_to_id: n.assigned_to_id, next_followup_date: n.next_followup_date })),
        ]
        const alerts = computeAlerts(items, new Date())
        const me = members.find(m => m.name.toLowerCase() === (userDisplayName || '').toLowerCase())
        const mine = me ? alerts.filter(a => a.assigned_to_id === me.id) : alerts
        cachedCount = { value: mine.length, timestamp: Date.now() }
        setCount(mine.length)
      })
      .catch(() => setCount(0))
  }, [userDisplayName])

  return (
    <button
      onClick={() => navigate('/mercado')}
      aria-label="Alertas de Mercado"
      className="relative p-2 rounded-lg bg-apple-gray-100 dark:bg-apple-gray-800 hover:bg-apple-gray-200 dark:hover:bg-apple-gray-700 transition-all duration-200 ease-apple group"
    >
      <svg className="w-5 h-5 text-apple-gray-600 dark:text-apple-gray-300 group-hover:text-apple-gray-800 dark:group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-2xs font-bold flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  )
}

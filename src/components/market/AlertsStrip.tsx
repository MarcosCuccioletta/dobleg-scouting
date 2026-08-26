import { useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import type { MarketAlert } from '@/utils/marketAlerts'

export default function AlertsStrip({ alerts, onSelectAlert }: { alerts: MarketAlert[]; onSelectAlert: (alert: MarketAlert) => void }) {
  const { t } = useLanguage()
  const [collapsed, setCollapsed] = useState(false)

  if (alerts.length === 0) return null

  const vencidos = alerts.filter(a => a.urgency === 'vencido')
  const proximos = alerts.filter(a => a.urgency === 'proximo')

  return (
    <div className="mb-5 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {vencidos.length > 0 && `${vencidos.length} ${vencidos.length !== 1 ? t('mercado.vencidoPlural') : t('mercado.vencidoSingular')}`}
          {vencidos.length > 0 && proximos.length > 0 && ' · '}
          {proximos.length > 0 && `${proximos.length} ${t('mercado.porVencer')}`}
        </span>
        <svg className={`w-4 h-4 text-amber-600 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {!collapsed && (
        <div className="px-4 pb-3 space-y-1.5">
          {alerts.map(alert => (
            <button
              key={`${alert.kind}-${alert.id}`}
              onClick={() => onSelectAlert(alert)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/60 dark:bg-apple-gray-800/40 hover:bg-white dark:hover:bg-apple-gray-800 transition-colors text-left"
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${alert.urgency === 'vencido' ? 'bg-red-500' : 'bg-amber-500'}`} />
              <span className="text-xs text-apple-gray-700 dark:text-apple-gray-300">
                {alert.kind === 'negotiation' ? t('mercado.negociacionLabel') : t('mercado.objetivoLabel')} #{alert.id} — {alert.next_followup_date}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

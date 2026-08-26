import { TeamLogo, PlayerPhoto } from '@/components/ui/PlayerPhoto'
import { buildPlayerPhotoUrl } from '@/utils/marketAlerts'
import { useLanguage } from '@/context/LanguageContext'
import type { Negotiation, NegotiationStatus } from '@/types/market'

export const NEGOTIATION_STATUS_LABEL_KEY: Record<NegotiationStatus, string> = {
  contactado: 'mercado.estadoContactado',
  reunion: 'mercado.estadoReunion',
  oferta_enviada: 'mercado.estadoOfertaEnviada',
  en_espera: 'mercado.estadoEnEspera',
  cerrado_exitoso: 'mercado.estadoCerradoExitoso',
  cerrado_rechazado: 'mercado.estadoCerradoRechazado',
}

export const NEGOTIATION_STATUS_COLOR: Record<NegotiationStatus, string> = {
  contactado: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  reunion: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  oferta_enviada: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  en_espera: 'bg-apple-gray-100 text-apple-gray-600 dark:bg-apple-gray-700 dark:text-apple-gray-300',
  cerrado_exitoso: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cerrado_rechazado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function NegotiationCard({ negotiation, onClick }: { negotiation: Negotiation; onClick: () => void }) {
  const { t } = useLanguage()
  const photoUrl = buildPlayerPhotoUrl(negotiation.player_api_id)

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-apple-gray-800 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 p-4 hover:shadow-apple-md dark:hover:shadow-apple-dark-md transition-all"
    >
      <div className="flex items-center gap-3 mb-3">
        <TeamLogo src={negotiation.team_logo} className="w-10 h-10 drop-shadow-md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-apple-gray-800 dark:text-white truncate">{negotiation.team_name}</p>
          {negotiation.assigned_to_name && (
            <p className="text-xs text-apple-gray-400">{t('mercado.responsable')}: {negotiation.assigned_to_name}</p>
          )}
        </div>
        <span className={`px-2 py-1 rounded-full text-2xs font-semibold flex-shrink-0 ${NEGOTIATION_STATUS_COLOR[negotiation.status]}`}>
          {t(NEGOTIATION_STATUS_LABEL_KEY[negotiation.status])}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <PlayerPhoto src={photoUrl} name={negotiation.player_name} size="sm" />
        <span className="text-sm font-medium text-apple-gray-700 dark:text-apple-gray-200">{negotiation.player_name}</span>
      </div>
      {(negotiation.contact_name || negotiation.next_followup_date) && (
        <div className="mt-3 pt-3 border-t border-apple-gray-100 dark:border-apple-gray-700 flex items-center justify-between text-xs text-apple-gray-500">
          <span>{negotiation.contact_name}{negotiation.contact_role ? ` · ${negotiation.contact_role}` : ''}</span>
          {negotiation.next_followup_date && <span>{t('mercado.seguimientoLabel')}: {negotiation.next_followup_date}</span>}
        </div>
      )}
    </button>
  )
}

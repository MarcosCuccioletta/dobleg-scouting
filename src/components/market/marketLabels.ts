import type { NegotiationStatus, NeedStatus, CandidateStatus } from '@/types/market'

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

export const NEED_STATUS_LABEL_KEY: Record<NeedStatus, string> = {
  abierto: 'mercado.estadoAbierto',
  cerrado: 'mercado.estadoCerrado',
}

export const NEED_STATUS_COLOR: Record<NeedStatus, string> = {
  abierto: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  cerrado: 'bg-apple-gray-100 text-apple-gray-600 dark:bg-apple-gray-700 dark:text-apple-gray-300',
}

export const CANDIDATE_STATUS_LABEL_KEY: Record<CandidateStatus, string> = {
  propuesto: 'mercado.candidatoPropuesto',
  en_negociacion: 'mercado.candidatoEnNegociacion',
  descartado: 'mercado.candidatoDescartado',
  fichado: 'mercado.candidatoFichado',
}

export const CANDIDATE_STATUS_COLOR: Record<CandidateStatus, string> = {
  propuesto: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  en_negociacion: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  descartado: 'bg-apple-gray-100 text-apple-gray-500 dark:bg-apple-gray-700 dark:text-apple-gray-400 line-through',
  fichado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

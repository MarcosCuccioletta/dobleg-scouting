import type { NegotiationStatus, NeedStatus, CandidateStatus } from '@/types/market'

export const NEGOTIATION_STATUS_LABEL_KEY: Record<NegotiationStatus, string> = {
  ofrecido: 'mercado.estadoOfrecido',
  pausado: 'mercado.estadoPausado',
  en_negociacion: 'mercado.estadoEnNegociacion',
  avanzado: 'mercado.estadoAvanzado',
  cerrado_exito: 'mercado.estadoCerradoExito',
  cerrado_caido: 'mercado.estadoCerradoCaido',
}

export const NEGOTIATION_STATUS_COLOR: Record<NegotiationStatus, string> = {
  ofrecido: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  pausado: 'bg-apple-gray-100 text-apple-gray-600 dark:bg-apple-gray-700 dark:text-apple-gray-300',
  en_negociacion: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  avanzado: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  cerrado_exito: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cerrado_caido: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
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

import LZString from 'lz-string'
import type { InformeDT } from './types'

const KEY = 'scout_informes_dt_v1'

function readAll(): InformeDT[] {
  const raw = localStorage.getItem(KEY)
  if (!raw) return []
  try {
    const json = raw.startsWith('{') || raw.startsWith('[') ? raw : LZString.decompressFromUTF16(raw)
    return json ? (JSON.parse(json) as InformeDT[]) : []
  } catch {
    return []
  }
}

function writeAll(all: InformeDT[]): void {
  try {
    localStorage.setItem(KEY, LZString.compressToUTF16(JSON.stringify(all)))
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      throw new Error('No se pudo guardar: hay demasiados informes de entrenador guardados. Borrá alguno viejo y probá de nuevo.')
    }
    throw e
  }
}

export function saveInformeDT(informe: InformeDT): void {
  const all = readAll()
  const idx = all.findIndex(i => i.id === informe.id)
  if (idx >= 0) all[idx] = informe
  else all.push(informe)
  writeAll(all)
}

export function listInformesDT(): InformeDT[] {
  return readAll()
}

export function loadInformeDT(id: string): InformeDT | null {
  return readAll().find(i => i.id === id) ?? null
}

export function deleteInformeDT(id: string): void {
  writeAll(readAll().filter(i => i.id !== id))
}

export function newInformeDTId(): string {
  return `dt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

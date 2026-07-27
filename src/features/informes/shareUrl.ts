// Armado del link público del informe. Módulo puro (sin Supabase ni red) para
// poder testearlo y para que el HTML pueda contener su propia URL: el `og:url`
// tiene que existir ANTES de subir el archivo.

// Netlify (netlify.toml, regla `/i/*`) proxea a Supabase Storage, así el que
// recibe ve nuestro dominio y no la URL de Supabase.
export const SHARE_BASE = 'https://dobleg-scouting.netlify.app/i'

export function slugify(nombre: string): string {
  return (
    nombre
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'informe'
  )
}

/**
 * Clave estable del objeto en el bucket: `<nombre>-<token>.html`. El token sale
 * del id, así re-compartir sobreescribe el MISMO archivo (el link no se rompe).
 */
export function informeShareKey(informeId: string, nombre: string): string {
  const token = informeId.replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase() || 'informe'
  return `${slugify(nombre)}-${token}.html`
}

/**
 * Token de versión para el link.
 *
 * WhatsApp cachea la preview POR URL y no la vuelve a pedir. Como la clave del
 * informe es estable, un link compartido antes de tener etiquetas og quedaba
 * marcado para siempre como "sin preview", incluso después de regenerarlo. Con
 * un `?v=` distinto en cada generación, el crawler lo trata como link nuevo y
 * lo lee otra vez. La función que sirve `/i/` ignora el query string, así que
 * el informe se abre igual.
 */
export function shareVersionToken(nowMs: number): string {
  return Math.floor(nowMs / 1000).toString(36)
}

export function withVersion(url: string, token: string): string {
  if (!token) return url
  return `${url}${url.includes('?') ? '&' : '?'}v=${token}`
}

/** Link final con la marca propia, opcionalmente versionado. */
export function brandedShareUrl(informeId: string, nombre: string, version = ''): string {
  return withVersion(`${SHARE_BASE}/${informeShareKey(informeId, nombre)}`, version)
}

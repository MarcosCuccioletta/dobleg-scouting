import { supabase } from '@/lib/supabase'
import { brandedOgImageUrl, brandedShareUrl, informeOgImageKey, informeShareKey, withVersion } from './shareUrl'

export { informeShareKey, shareVersionToken } from './shareUrl'

// Bucket público de Supabase Storage donde viven los informes compartibles.
// Se crea con la migración `*_informes_share_bucket.sql`.
const BUCKET = 'informes-compartidos'

// El link branded solo funciona cuando la feature está DEPLOYADA en Netlify (ahí
// vive la regla de proxy `/i/*`). Mientras se prueba en local / sin deployar,
// dejamos `false` para devolver la URL directa de Supabase (anda desde cualquier
// lado). Al publicar la feature, poné `true`.
const USE_BRANDED_LINK = true

/**
 * URL final del informe, calculable ANTES de subirlo. Hace falta para poder
 * escribir `og:url` dentro del propio HTML que se sube.
 *
 * `version` cambia en cada generación: es lo que hace que WhatsApp vuelva a leer
 * la preview en vez de servir la que cacheó la primera vez (ver shareUrl.ts).
 */
export function informeShareUrl(informeId: string, nombre: string, version = ''): string {
  if (USE_BRANDED_LINK) return brandedShareUrl(informeId, nombre, version)
  const key = informeShareKey(informeId, nombre)
  const url = supabase.storage.from(BUCKET).getPublicUrl(key).data?.publicUrl ?? ''
  return url ? withVersion(url, version) : ''
}

/**
 * Sube la tarjeta de preview (Open Graph) y devuelve su URL absoluta.
 * Va al mismo bucket, con la misma clave pero `.jpg`. El `?v=` es para que
 * WhatsApp no se quede con una versión vieja cacheada cuando reeditás.
 *
 * La URL que se devuelve es la de NUESTRO dominio (`/i/<slug>.jpg`), no la de
 * Storage: la imagen y la página salen del mismo origen, que es lo que mejor
 * digieren los crawlers de WhatsApp/LinkedIn.
 */
export async function uploadInformeOgImage(
  blob: Blob,
  informeId: string,
  nombre: string,
  version = '',
): Promise<string | null> {
  const key = informeOgImageKey(informeId, nombre)
  const { error } = await supabase.storage.from(BUCKET).upload(key, blob, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '3600',
  })
  if (error) return null

  if (USE_BRANDED_LINK) return brandedOgImageUrl(informeId, nombre, version)
  const url = supabase.storage.from(BUCKET).getPublicUrl(key).data?.publicUrl
  return url ? withVersion(url, version) : null
}

/**
 * Sube el HTML autocontenido del informe a Storage y devuelve su URL pública.
 * Usa `upsert` sobre una ruta estable (por id): si el usuario edita y vuelve a
 * compartir, el MISMO link queda actualizado. `Content-Type: text/html` hace que
 * el navegador lo muestre (no lo descargue).
 */
export async function uploadInformeHtml(
  html: string,
  informeId: string,
  nombre: string,
  version = '',
): Promise<string> {
  // OJO: la extensión .html es OBLIGATORIA — sin ella Supabase sirve el archivo
  // como text/plain y el navegador muestra el código fuente en vez de renderizar
  // (el contentType solo no alcanza). Los acentos los resuelve el <meta charset>.
  const key = informeShareKey(informeId, nombre)
  const blob = new Blob([html], { type: 'text/html' })

  const { error } = await supabase.storage.from(BUCKET).upload(key, blob, {
    upsert: true,
    contentType: 'text/html',
    cacheControl: '60',
  })
  if (error) throw new Error(error.message)

  const url = informeShareUrl(informeId, nombre, version)
  if (!url) throw new Error('No se pudo obtener el link público del informe.')
  return url
}

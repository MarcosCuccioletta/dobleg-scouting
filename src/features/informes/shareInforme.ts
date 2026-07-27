import { supabase } from '@/lib/supabase'

// Bucket público de Supabase Storage donde viven los informes compartibles.
// Se crea con la migración `*_informes_share_bucket.sql`.
const BUCKET = 'informes-compartidos'

// Link con marca propia: Netlify (netlify.toml, regla `/i/*`) hace de proxy a
// Supabase Storage, así el que recibe ve tu dominio y no la URL fea de Supabase.
// El objeto se sube SIN extensión .html (se sirve como HTML por su content-type),
// para que el link quede lo más limpio posible: dobleg-scouting.netlify.app/i/<slug>-<token>
const SHARE_BASE = 'https://dobleg-scouting.netlify.app/i'

// El link branded solo funciona cuando la feature está DEPLOYADA en Netlify (ahí
// vive la regla de proxy `/i/*`). Mientras se prueba en local / sin deployar,
// dejamos `false` para devolver la URL directa de Supabase (anda desde cualquier
// lado). Al publicar la feature, poné `true`.
const USE_BRANDED_LINK = true

function slugify(nombre: string): string {
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
 * Clave estable del informe en el bucket: `<nombre>-<token>.html`. El token
 * deriva del id, así re-compartir sobreescribe el MISMO objeto (mismo link).
 */
export function informeShareKey(informeId: string, nombre: string): string {
  const token = informeId.replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase() || 'informe'
  return `${slugify(nombre)}-${token}.html`
}

/**
 * URL final del informe, calculable ANTES de subirlo. Hace falta para poder
 * escribir `og:url` dentro del propio HTML que se sube.
 */
export function informeShareUrl(informeId: string, nombre: string): string {
  const key = informeShareKey(informeId, nombre)
  if (USE_BRANDED_LINK) return `${SHARE_BASE}/${key}`
  return supabase.storage.from(BUCKET).getPublicUrl(key).data?.publicUrl ?? ''
}

/**
 * Sube la tarjeta de preview (Open Graph) y devuelve su URL pública absoluta.
 * Va al mismo bucket, con la misma clave pero `.jpg`. El `?v=` es para que
 * WhatsApp no se quede con una versión vieja cacheada cuando reeditás.
 */
export async function uploadInformeOgImage(
  blob: Blob,
  informeId: string,
  nombre: string,
): Promise<string | null> {
  const key = informeShareKey(informeId, nombre).replace(/\.html$/, '.jpg')
  const { error } = await supabase.storage.from(BUCKET).upload(key, blob, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '3600',
  })
  if (error) return null
  const url = supabase.storage.from(BUCKET).getPublicUrl(key).data?.publicUrl
  return url ? `${url}?v=${Date.now().toString(36)}` : null
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

  if (USE_BRANDED_LINK) {
    // Link con la marca propia (proxeado por Netlify a Supabase). Requiere deploy.
    return `${SHARE_BASE}/${key}`
  }
  // Pre-deploy: URL directa de Supabase (se sirve como HTML por su content-type).
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key)
  if (!data?.publicUrl) throw new Error('No se pudo obtener el link público del informe.')
  return data.publicUrl
}

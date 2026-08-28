import { useState } from 'react'
import type { InformeDT } from '../types'
import { buildInformeDTHtml } from '../buildInformeDTHtml'
import { exportInformeDTHTML } from '../exportInformeDTHTML'
import { uploadInformeHtml, uploadInformeOgImage, informeShareUrl, shareVersionToken } from '@/features/informes/shareInforme'
import { buildOgImageBlob } from '@/features/informes/ogImage'

async function loadLogoDataUrl(path: string): Promise<string | undefined> {
  try {
    const res = await fetch(path)
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as string)
      fr.onerror = () => reject(fr.error)
      fr.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

export default function Step4PreviewDT({
  informe,
  onBack,
  onSave,
}: {
  informe: InformeDT
  onBack: () => void
  onSave: () => void
}) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const html = buildInformeDTHtml(informe)

  const handleShare = async () => {
    setSharing(true)
    setShareError(null)
    try {
      const nombreKey = informe.content.nombre || 'informe'

      // Mismo token de versión para el link, la imagen y el og:url. Si difirieran,
      // WhatsApp podría canonicalizar al link sin versión y servir la preview
      // vieja que tenía cacheada (ver shareUrl.ts).
      const version = shareVersionToken(Date.now())
      const link = informeShareUrl(informe.id, nombreKey, version)

      // La tarjeta se sube primero: su URL tiene que estar adentro del HTML
      // como og:image antes de subir el HTML.
      let imageUrl: string | null = null
      try {
        const logoDataUrl = await loadLogoDataUrl('/brand/logo-white.png')
        const og = await buildOgImageBlob({
          nombre: informe.content.nombre,
          club: informe.content.club,
          posicion: informe.content.cargo,
          edad: informe.content.edad,
          liga: informe.content.liga,
          fotoDataUrl: informe.content.fotoDataUrl,
          logoDataUrl,
        })
        if (og) imageUrl = await uploadInformeOgImage(og, informe.id, nombreKey, version)
      } catch (e) {
        // Sin imagen se comparte igual: el link sigue mostrando título y descripción.
        console.warn('No se pudo generar la imagen de preview:', e)
      }

      const htmlToShare = buildInformeDTHtml(informe, { url: link, imageUrl })
      await uploadInformeHtml(htmlToShare, informe.id, nombreKey, version)
      setShareUrl(link)
    } catch (e) {
      console.error('Error al compartir informe de entrenador:', e)
      setShareError('No se pudo generar el link. Probá de nuevo.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="space-y-4">
      <iframe
        title="preview"
        srcDoc={html}
        className="w-full h-[70vh] rounded-xl border border-apple-gray-200 dark:border-apple-gray-700"
      />
      <div className="flex flex-wrap gap-2 justify-between">
        <button type="button" onClick={onBack} className="px-4 py-2 text-sm text-apple-gray-500">
          Atrás
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSave}
            className="px-4 py-2 rounded-xl bg-apple-gray-100 dark:bg-apple-gray-800 text-sm font-semibold"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => exportInformeDTHTML(informe)}
            className="px-4 py-2 rounded-xl bg-apple-gray-100 dark:bg-apple-gray-800 text-sm font-semibold"
          >
            Exportar HTML
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            className="px-4 py-2 rounded-xl bg-brand-green text-apple-gray-900 text-sm font-semibold disabled:opacity-50"
          >
            {sharing ? 'Compartiendo...' : 'Compartir'}
          </button>
        </div>
      </div>
      {shareError && <p className="text-xs text-red-500">{shareError}</p>}
      {shareUrl && (
        <p className="text-xs text-apple-gray-500">
          Link: <a href={shareUrl} target="_blank" rel="noreferrer" className="text-brand-green">{shareUrl}</a>
        </p>
      )}
    </div>
  )
}

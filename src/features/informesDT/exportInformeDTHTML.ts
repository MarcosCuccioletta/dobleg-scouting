import { buildInformeDTHtml } from './buildInformeDTHtml'
import type { InformeDT } from './types'

/** Descarga el informe de entrenador como HTML autocontenido (mismo criterio que exportInformeHTML.ts para jugadores). */
export function exportInformeDTHTML(informe: InformeDT): void {
  const html = buildInformeDTHtml(informe)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Informe_DT_${informe.content.nombre.replace(/\s+/g, '_')}.html`
  a.click()
  URL.revokeObjectURL(url)
}

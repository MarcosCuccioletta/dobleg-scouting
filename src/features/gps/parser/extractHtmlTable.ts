import type { HtmlTable } from '../types'

/** "1.617" (separador de miles europeo) → "1617". No toca "28.8": el patrón exige
 * grupos de exactamente 3 dígitos después de cada punto, así que nunca confunde un
 * decimal real con miles agrupados. */
const THOUSANDS_RE = /^\d{1,3}(\.\d{3})+$/

function normalizeCellText(text: string): string {
  return THOUSANDS_RE.test(text) ? text.replace(/\./g, '') : text
}

/**
 * Lee la primera <table> del HTML con más de una fila de datos. Prioriza el
 * atributo `data-v` de cada celda (valor numérico "limpio" que algunos reportes ya
 * traen, como el historial de Loyola) sobre el texto visible, que puede tener texto
 * agregado (comillas de minutos, separador de miles).
 */
export function extractHtmlTable(html: string): HtmlTable | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const tables = Array.from(doc.querySelectorAll('table'))
  const table = tables.find(t => t.querySelectorAll('tr').length > 1)
  if (!table) return null

  const trs = Array.from(table.querySelectorAll('tr'))
  const headers = Array.from(trs[0].querySelectorAll('th, td')).map(c => c.textContent?.trim() ?? '')
  const rows = trs.slice(1)
    .map(tr => Array.from(tr.querySelectorAll('td, th')).map(cell => {
      const dataV = cell.getAttribute('data-v')
      return dataV !== null ? dataV : normalizeCellText(cell.textContent?.trim() ?? '')
    }))
    .filter(row => row.some(cell => cell !== ''))

  if (headers.length === 0 || rows.length === 0) return null
  return { headers, rows }
}

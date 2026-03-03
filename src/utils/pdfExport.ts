import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

interface ExportOptions {
  filename?: string
  orientation?: 'portrait' | 'landscape'
  scale?: number
}

async function captureElement(element: HTMLElement, scale = 2): Promise<HTMLCanvasElement> {
  return html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: document.documentElement.classList.contains('dark') ? '#111111' : '#ffffff',
    onclone: (doc) => {
      // Apply dark class to cloned document
      if (document.documentElement.classList.contains('dark')) {
        doc.documentElement.classList.add('dark')
      }
    },
  })
}

function canvasToPdf(canvas: HTMLCanvasElement, opts: ExportOptions): jsPDF {
  const { orientation = 'landscape', filename = 'scout-report.pdf' } = opts
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })

  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  const imgData = canvas.toDataURL('image/png')
  const imgHeight = (canvas.height * pdfWidth) / canvas.width

  if (imgHeight <= pdfHeight) {
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight)
  } else {
    // Multi-page: calculate pixel-height per PDF page
    const pageHeightPx = (pdfHeight / pdfWidth) * canvas.width
    let yOffset = 0

    while (yOffset < canvas.height) {
      const remainingPx = canvas.height - yOffset
      const slicePx = Math.min(pageHeightPx, remainingPx)

      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = slicePx
      const ctx = pageCanvas.getContext('2d')!
      ctx.drawImage(canvas, 0, yOffset, canvas.width, slicePx, 0, 0, canvas.width, slicePx)

      const pageImg = pageCanvas.toDataURL('image/png')
      const sliceHeight = (slicePx * pdfWidth) / canvas.width

      if (yOffset > 0) pdf.addPage()
      pdf.addImage(pageImg, 'PNG', 0, 0, pdfWidth, sliceHeight)

      yOffset += slicePx
    }
  }

  // Add header with logo text
  pdf.setFontSize(8)
  pdf.setTextColor(100)
  pdf.text('Doble G Sports Group — Scout Platform', 5, 5)
  pdf.text(new Date().toLocaleDateString('es-ES'), pdfWidth - 35, 5)

  pdf.save(filename)
  return pdf
}

export async function exportElementToPdf(
  elementId: string,
  opts: ExportOptions = {}
): Promise<void> {
  const element = document.getElementById(elementId)
  if (!element) {
    console.warn(`Element #${elementId} not found for PDF export`)
    return
  }
  const canvas = await captureElement(element, opts.scale ?? 2)
  canvasToPdf(canvas, opts)
}

export async function exportPlayerToPdf(playerName: string): Promise<void> {
  await exportElementToPdf('player-detail-content', {
    filename: `${playerName.replace(/[^a-zA-Z0-9]/g, '_')}-scout.pdf`,
    orientation: 'portrait',
  })
}

export async function exportTableToPdf(title: string): Promise<void> {
  await exportElementToPdf('player-table-export', {
    filename: `scouting-${title}-${new Date().toISOString().slice(0, 10)}.pdf`,
    orientation: 'landscape',
  })
}

export async function exportComparisonToPdf(names: string[]): Promise<void> {
  await exportElementToPdf('comparison-content', {
    filename: `comparacion-${names.join('_vs_').replace(/[^a-zA-Z0-9_]/g, '')}.pdf`,
    orientation: 'landscape',
  })
}

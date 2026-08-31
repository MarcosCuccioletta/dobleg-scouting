import { useRef, useState } from 'react'
import { parseNacsportXml, type ParsedInstance } from '@/features/coaches/videoAnalysis/parseNacsportXml'

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm']

function extOf(file: File): string {
  return file.name.split('.').pop()?.toLowerCase() ?? ''
}

export default function VideoAnalysisDropzone({
  onParsed,
}: {
  onParsed: (result: { instances: ParsedInstance[]; matchDate: string; opponentName: string | null; videoFile: File | null }) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ instances: ParsedInstance[]; videoFile: File | null } | null>(null)
  const [matchDate, setMatchDate] = useState('')
  const [opponentName, setOpponentName] = useState('')

  async function handleFiles(files: FileList | File[]) {
    setError(null)
    const list = Array.from(files)
    const xmlFile = list.find(f => extOf(f) === 'xml')
    const videoFile = list.find(f => VIDEO_EXTENSIONS.includes(extOf(f))) ?? null

    if (!xmlFile) {
      setError('Hace falta un archivo .xml del videoanálisis.')
      return
    }

    try {
      const text = await xmlFile.text()
      const { instances } = parseNacsportXml(text)
      setPending({ instances, videoFile })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    }
  }

  function confirm() {
    if (!pending || !matchDate) return
    onParsed({
      instances: pending.instances,
      matchDate,
      opponentName: opponentName.trim() || null,
      videoFile: pending.videoFile,
    })
    setPending(null)
    setMatchDate('')
    setOpponentName('')
  }

  if (pending) {
    return (
      <div className="space-y-3 bg-apple-gray-50 dark:bg-apple-gray-900/40 rounded-apple-lg p-4">
        <p className="text-xs text-apple-gray-500 dark:text-apple-gray-400">
          {pending.instances.length} cortes detectados{pending.videoFile ? ` · video: ${pending.videoFile.name}` : ''}
        </p>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1">Fecha del partido</label>
          <input
            type="date"
            value={matchDate}
            onChange={e => setMatchDate(e.target.value)}
            className="w-full min-h-[40px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-apple-gray-500 dark:text-apple-gray-400 mb-1">Rival (opcional)</label>
          <input
            type="text"
            value={opponentName}
            onChange={e => setOpponentName(e.target.value)}
            placeholder="Ej: Quilmes"
            className="w-full min-h-[40px] rounded-lg border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPending(null)} className="flex-1 min-h-[40px] rounded-lg text-sm text-apple-gray-500">
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!matchDate}
            className="flex-1 min-h-[40px] rounded-lg bg-brand-green text-apple-gray-900 text-sm font-semibold disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); void handleFiles(e.dataTransfer.files) }}
      className={`rounded-apple-xl border-2 border-dashed transition-colors ${
        over ? 'border-brand-green bg-brand-green/5' : 'border-apple-gray-200 dark:border-apple-gray-600'
      }`}
    >
      <button type="button" onClick={() => inputRef.current?.click()} className="w-full px-4 py-6 text-center">
        <p className="text-sm font-medium text-apple-gray-800 dark:text-white">
          Arrastrá el XML (y el video, opcional) del próximo partido acá
        </p>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xml,video/*"
        className="hidden"
        onChange={e => { if (e.target.files) void handleFiles(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}

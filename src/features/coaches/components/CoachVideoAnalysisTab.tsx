// src/features/coaches/components/CoachVideoAnalysisTab.tsx
import { useEffect, useMemo, useState } from 'react'
import type { AgencyCoach } from '@/constants/agencyCoaches'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import {
  ensurePropioBucket, listBuckets, createRivalBucket, deleteBucket,
  listMatches, createMatch, deleteMatch, uploadMatchVideo,
  type VideoAnalysisBucket, type VideoAnalysisMatch,
} from '@/services/videoAnalysisService'
import { countByCode, countByPhase, pitchPoints, type StatsMatch } from '@/features/coaches/videoAnalysis/videoAnalysisStats'
import type { ParsedInstance } from '@/features/coaches/videoAnalysis/parseNacsportXml'
import VideoAnalysisDateRangeSlider from './VideoAnalysisDateRangeSlider'
import VideoAnalysisPitch from './VideoAnalysisPitch'
import VideoAnalysisCategoryChart from './VideoAnalysisCategoryChart'
import VideoAnalysisPhaseChart from './VideoAnalysisPhaseChart'
import VideoAnalysisEvolutionChart from './VideoAnalysisEvolutionChart'
import VideoAnalysisDropzone from './VideoAnalysisDropzone'
import VideoAnalysisClipPlayer from './VideoAnalysisClipPlayer'

export default function CoachVideoAnalysisTab({ coach }: { coach: AgencyCoach }) {
  const [buckets, setBuckets] = useState<VideoAnalysisBucket[] | null>(null)
  const [activeBucketId, setActiveBucketId] = useState<number | null>(null)
  const [matches, setMatches] = useState<VideoAnalysisMatch[] | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [showNewRival, setShowNewRival] = useState(false)
  const [newRivalName, setNewRivalName] = useState('')
  const [uploadingVideoFor, setUploadingVideoFor] = useState<number | null>(null)
  const [playingClip, setPlayingClip] = useState<{ videoPath: string; start: number; end: number } | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      const propio = await ensurePropioBucket(coach.key)
      const all = await listBuckets(coach.key)
      if (!active) return
      setBuckets(all)
      setActiveBucketId(propio?.id ?? all[0]?.id ?? null)
    }
    void load()
    return () => { active = false }
  }, [coach.key])

  useEffect(() => {
    if (activeBucketId === null) return
    let active = true
    listMatches(activeBucketId).then(m => {
      if (!active) return
      setMatches(m)
      const dates = m.map(x => x.match_date).sort()
      setFromDate(dates[0] ?? '')
      setToDate(dates[dates.length - 1] ?? '')
    })
    return () => { active = false }
  }, [activeBucketId])

  const filteredMatches: StatsMatch[] = useMemo(() => {
    if (!matches) return []
    return matches.filter(m => (!fromDate || m.match_date >= fromDate) && (!toDate || m.match_date <= toDate))
  }, [matches, fromDate, toDate])

  const codeStats = useMemo(() => countByCode(filteredMatches), [filteredMatches])
  const phaseStats = useMemo(() => countByPhase(filteredMatches), [filteredMatches])
  const topCode = codeStats[0]?.code ?? ''
  const pitchData = useMemo(() => (topCode ? pitchPoints(filteredMatches, topCode) : { exact: [], zones: [] }), [filteredMatches, topCode])

  async function handleCreateRival() {
    if (!newRivalName.trim()) return
    const bucket = await createRivalBucket(coach.key, newRivalName.trim())
    if (bucket) {
      setBuckets(prev => [...(prev ?? []), bucket])
      setActiveBucketId(bucket.id)
    }
    setShowNewRival(false)
    setNewRivalName('')
  }

  async function handleDeleteBucket(bucket: VideoAnalysisBucket) {
    const ok = window.confirm(`¿Borrar "${bucket.name}" y todos sus partidos cargados?`)
    if (!ok) return
    const res = await deleteBucket(bucket.id)
    if (!res.success) { window.alert('No se pudo borrar, intentá de nuevo.'); return }
    const remaining = (buckets ?? []).filter(b => b.id !== bucket.id)
    setBuckets(remaining)
    setActiveBucketId(remaining.find(b => b.kind === 'propio')?.id ?? remaining[0]?.id ?? null)
  }

  async function handleUpload(result: { instances: ParsedInstance[]; matchDate: string; opponentName: string | null; videoFile: File | null }) {
    if (activeBucketId === null) return
    const match = await createMatch(activeBucketId, result.matchDate, result.opponentName, result.instances)
    if (!match) { window.alert('No se pudo guardar el partido, intentá de nuevo.'); return }
    setMatches(prev => [match, ...(prev ?? [])].sort((a, b) => b.match_date.localeCompare(a.match_date)))
    if (result.videoFile) {
      setUploadingVideoFor(match.id)
      const res = await uploadMatchVideo(coach.key, activeBucketId, match.id, result.videoFile)
      setUploadingVideoFor(null)
      if (res.success && res.path) {
        setMatches(prev => (prev ?? []).map(m => (m.id === match.id ? { ...m, video_storage_path: res.path! } : m)))
      } else {
        window.alert(res.error ?? 'No se pudo subir el video. El partido quedó guardado sin video.')
      }
    }
  }

  async function handleDeleteMatch(match: VideoAnalysisMatch) {
    const ok = window.confirm(`¿Borrar el partido del ${match.match_date}?`)
    if (!ok) return
    const res = await deleteMatch(match.id)
    if (!res.success) { window.alert('No se pudo borrar, intentá de nuevo.'); return }
    setMatches(prev => (prev ?? []).filter(m => m.id !== match.id))
  }

  if (buckets === null || activeBucketId === null) return <LoadingSpinner message="Cargando videoanálisis..." />

  const matchDates = (matches ?? []).map(m => m.match_date).sort()
  const minDate = matchDates[0] ?? ''
  const maxDate = matchDates[matchDates.length - 1] ?? ''

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 flex-wrap">
        {buckets.map(b => (
          <div key={b.id} className="flex items-center">
            <button
              type="button"
              onClick={() => setActiveBucketId(b.id)}
              className={`min-h-[32px] px-3 rounded-full text-xs font-semibold ${
                b.id === activeBucketId ? 'bg-brand-green text-apple-gray-900' : 'bg-apple-gray-100 dark:bg-apple-gray-700 text-apple-gray-500 dark:text-apple-gray-400'
              }`}
            >
              {b.kind === 'propio' ? 'Propio equipo' : b.name}
            </button>
            {b.kind === 'rival' && b.id === activeBucketId && (
              <button type="button" onClick={() => void handleDeleteBucket(b)} className="ml-1 text-2xs text-red-500">✕</button>
            )}
          </div>
        ))}
        {showNewRival ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={newRivalName}
              onChange={e => setNewRivalName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void handleCreateRival()}
              placeholder="Nombre del rival"
              className="min-h-[32px] rounded-full border border-apple-gray-200 dark:border-apple-gray-700 bg-white dark:bg-apple-gray-900 px-3 text-xs"
            />
            <button type="button" onClick={() => void handleCreateRival()} className="text-xs font-semibold text-brand-green">Crear</button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowNewRival(true)} className="min-h-[32px] px-3 rounded-full border border-dashed border-apple-gray-300 dark:border-apple-gray-600 text-xs font-semibold text-brand-green">
            + Nuevo rival
          </button>
        )}
      </div>

      {matches === null ? (
        <LoadingSpinner message="Cargando partidos..." />
      ) : (
        <>
          <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4">
            <div className="flex justify-around pb-3 mb-3 border-b border-apple-gray-100 dark:border-apple-gray-700/40 text-center">
              <div><div className="text-lg font-bold text-apple-gray-800 dark:text-white">{matches.length}</div><div className="text-2xs text-apple-gray-400 uppercase">Partidos</div></div>
              <div><div className="text-lg font-bold text-apple-gray-800 dark:text-white">{filteredMatches.flatMap(m => m.instances).length}</div><div className="text-2xs text-apple-gray-400 uppercase">Cortes</div></div>
              <div><div className="text-lg font-bold text-apple-gray-800 dark:text-white">{codeStats.length}</div><div className="text-2xs text-apple-gray-400 uppercase">Categorías</div></div>
            </div>
            {minDate && maxDate && (
              <VideoAnalysisDateRangeSlider minDate={minDate} maxDate={maxDate} fromDate={fromDate || minDate} toDate={toDate || maxDate} onChange={(f, t) => { setFromDate(f); setToDate(t) }} />
            )}
          </div>

          {matches.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4">
                <p className="text-2xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-2">Cancha — {topCode || 'sin categoría'}</p>
                <VideoAnalysisPitch exact={pitchData.exact} zones={pitchData.zones} />
              </div>
              <div className="flex flex-col gap-4">
                <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4">
                  <VideoAnalysisCategoryChart data={codeStats} />
                </div>
                <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4">
                  <VideoAnalysisPhaseChart counts={phaseStats} />
                </div>
                <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4">
                  <VideoAnalysisEvolutionChart matches={filteredMatches} />
                </div>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-apple-gray-800/60 rounded-apple-lg border border-apple-gray-200/60 dark:border-apple-gray-700/40 p-4">
            <p className="text-2xs font-semibold text-apple-gray-400 uppercase tracking-wide mb-2">Partidos cargados</p>
            {matches.map(m => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-apple-gray-100 dark:border-apple-gray-700/40 text-sm">
                <span className="text-apple-gray-700 dark:text-apple-gray-300">
                  {m.opponent_name ? `vs ${m.opponent_name} · ` : ''}{m.match_date}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-2xs text-apple-gray-400">{m.instances.length} cortes</span>
                  {uploadingVideoFor === m.id && <span className="text-2xs text-amber-500">Subiendo video...</span>}
                  {m.video_storage_path && m.instances[0] && (
                    <button
                      type="button"
                      onClick={() => setPlayingClip({ videoPath: m.video_storage_path!, start: m.instances[0].start, end: m.instances[0].end })}
                      className="w-6 h-6 rounded-full bg-brand-green text-apple-gray-900 text-2xs flex items-center justify-center"
                    >▶</button>
                  )}
                  <button type="button" onClick={() => void handleDeleteMatch(m)} className="text-2xs text-red-500 font-semibold">Borrar</button>
                </div>
              </div>
            ))}
            <div className="mt-3">
              <VideoAnalysisDropzone onParsed={r => void handleUpload(r)} />
            </div>
          </div>
        </>
      )}

      {playingClip && (
        <VideoAnalysisClipPlayer videoPath={playingClip.videoPath} start={playingClip.start} end={playingClip.end} onClose={() => setPlayingClip(null)} />
      )}
    </div>
  )
}

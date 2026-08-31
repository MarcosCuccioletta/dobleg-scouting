import { useEffect, useRef } from 'react'
import { getMatchVideoUrl } from '@/services/videoAnalysisService'

export default function VideoAnalysisClipPlayer({
  videoPath,
  start,
  end,
  onClose,
}: {
  videoPath: string
  start: number
  end: number
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    function onLoaded() {
      video!.currentTime = start
      void video!.play()
    }
    function onTimeUpdate() {
      if (video!.currentTime >= end) video!.pause()
    }

    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('timeupdate', onTimeUpdate)
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('timeupdate', onTimeUpdate)
    }
  }, [start, end])

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="max-w-2xl w-full" onClick={e => e.stopPropagation()}>
        <video ref={videoRef} src={getMatchVideoUrl(videoPath)} controls className="w-full rounded-apple-lg" />
        <button type="button" onClick={onClose} className="mt-3 text-sm text-white/80 hover:text-white">
          Cerrar
        </button>
      </div>
    </div>
  )
}

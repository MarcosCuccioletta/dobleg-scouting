export default function VideoAnalysisPitch({
  exact,
  zones,
}: {
  exact: { x: number; y: number }[]
  zones: { x1: number; y1: number; x2: number; y2: number }[]
}) {
  return (
    <div className="bg-gradient-to-b from-emerald-600 to-emerald-700 rounded-2xl p-4 relative w-full aspect-[3/4] max-w-md mx-auto shadow-2xl overflow-hidden">
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 130" preserveAspectRatio="none">
        <rect x="2" y="2" width="96" height="126" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
        <circle cx="50" cy="65" r="12" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <line x1="2" y1="65" x2="98" y2="65" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <rect x="20" y="2" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <rect x="20" y="108" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
      </svg>

      {zones.map((z, i) => (
        <div
          key={i}
          className="absolute bg-brand-green/30 rounded-md"
          style={{ left: `${z.x1}%`, top: `${z.y1}%`, width: `${z.x2 - z.x1}%`, height: `${z.y2 - z.y1}%` }}
        />
      ))}

      {exact.map((p, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400 shadow"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
        />
      ))}

      {exact.length === 0 && zones.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-white/70 text-center px-6">Sin datos de posición para esta categoría.</p>
        </div>
      )}
    </div>
  )
}

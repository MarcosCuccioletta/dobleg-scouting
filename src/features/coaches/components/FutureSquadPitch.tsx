import { FORMATIONS, FORMATION_SHORT_LABEL_OVERRIDES } from '@/constants/formations'
import type { FutureSquadSlot } from '@/services/futureSquadService'

export default function FutureSquadPitch({
  formationType,
  slots,
  onSlotClick,
  onRemoveSlot,
}: {
  formationType: string
  slots: FutureSquadSlot[]
  onSlotClick: (slotKey: string) => void
  onRemoveSlot: (slotKey: string) => void
}) {
  const currentFormation = FORMATIONS[formationType] ?? FORMATIONS['4-3-3']

  return (
    <div className="bg-gradient-to-b from-emerald-600 to-emerald-700 rounded-2xl p-4 sm:p-6 relative aspect-[3/4] w-full max-w-xl mx-auto shadow-2xl overflow-hidden">
      {/* Lineas de campo -- mismo dibujo que /formacion y la pizarra tactica */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 130" preserveAspectRatio="none">
        <rect x="2" y="2" width="96" height="126" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
        <circle cx="50" cy="65" r="12" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <circle cx="50" cy="65" r="1" fill="rgba(255,255,255,0.5)" />
        <line x1="2" y1="65" x2="98" y2="65" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <rect x="20" y="2" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <rect x="30" y="2" width="40" height="8" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <rect x="20" y="108" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <rect x="30" y="120" width="40" height="8" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
        <path d="M 2 6 Q 2 2 6 2" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
        <path d="M 94 2 Q 98 2 98 6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
        <path d="M 2 124 Q 2 128 6 128" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
        <path d="M 94 128 Q 98 128 98 124" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
      </svg>

      {currentFormation.positions.map(pos => {
        const slot = slots.find(s => s.slotKey === pos.key)
        const occupied = !!slot && slot.source !== null
        const isCandidate = slot?.source === 'candidate'

        const label = occupied
          ? isCandidate
            ? slot!.playerName!.split(' ').slice(-1)[0]
            : String(slot!.playerNumber ?? slot!.playerName!.split(' ').slice(-1)[0])
          : FORMATION_SHORT_LABEL_OVERRIDES[formationType]?.[pos.key] ?? pos.key

        return (
          <div
            key={pos.key}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <button
              type="button"
              onClick={() => onSlotClick(pos.key)}
              className={`relative w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-xl transition-all ${
                occupied
                  ? isCandidate
                    ? 'bg-white text-apple-gray-900 ring-2 ring-sky-400'
                    : 'bg-white text-apple-gray-900'
                  : 'bg-white/15 border-2 border-dashed border-white/50 text-white/80 hover:bg-white/25 hover:border-white/70'
              }`}
            >
              <span className={occupied ? 'text-xs font-bold' : 'text-sm font-semibold'}>{label}</span>
            </button>

            {occupied && (
              <button
                type="button"
                onClick={() => onRemoveSlot(pos.key)}
                aria-label={isCandidate ? 'Quitar' : 'Dar de baja'}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {occupied && !isCandidate && (
              <p className="mt-1 text-center whitespace-nowrap text-2xs font-semibold text-white/90">
                {slot!.playerName!.split(' ').slice(-1)[0]}
              </p>
            )}
            {occupied && isCandidate && slot!.ggScore !== null && (
              <p className="mt-1 text-center whitespace-nowrap text-2xs font-bold text-sky-200">
                {slot!.ggScore!.toFixed(1)}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

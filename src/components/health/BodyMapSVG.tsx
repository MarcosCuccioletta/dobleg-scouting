import React, { useId, useMemo, useState } from 'react'
import { BODY_ZONES, VIEW_W, VIEW_H, zonesFromInjuryType, type BodyView } from './bodyZones'

export interface InjuryMark {
  /** Id de zona de `bodyZones`, o texto libre de la lesión (se traduce solo). */
  zone: string
  severity: 'leve' | 'moderada' | 'grave'
  label?: string
}

const SEVERITY_COLOR: Record<InjuryMark['severity'], string> = {
  leve: '#facc15',
  moderada: '#f97316',
  grave: '#ef4444',
}

const GAP = 24
const LABEL_H = 16
const TOTAL_W = VIEW_W * 2 + GAP
const TOTAL_H = VIEW_H + LABEL_H

interface Props {
  injuries?: InjuryMark[]
  onZoneClick?: (zoneId: string) => void
  interactive?: boolean
  className?: string
}

export default function BodyMapSVG({
  injuries = [],
  onZoneClick,
  interactive = false,
  className = '',
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  // Los ids de <filter> son globales al documento: si hay dos mapas montados a la
  // vez (ficha + PDF) tienen que ser distintos o uno pisa el filtro del otro.
  const uid = useId().replace(/:/g, '')

  /**
   * Lesión por zona. Acepta tanto un id de zona como el texto crudo de la lesión
   * ("Knee Injury"), que es lo que devuelve la API.
   */
  const injuryByZone = useMemo(() => {
    const map = new Map<string, InjuryMark>()
    const known = new Set(BODY_ZONES.map(z => z.id))
    for (const injury of injuries) {
      const targets = known.has(injury.zone) ? [injury.zone] : zonesFromInjuryType(injury.zone)
      for (const id of targets) {
        const prev = map.get(id)
        // Ante dos lesiones en la misma zona manda la más grave.
        if (!prev || severityRank(injury.severity) > severityRank(prev.severity)) {
          map.set(id, injury)
        }
      }
    }
    return map
  }, [injuries])

  function showTooltip(evt: React.MouseEvent<SVGElement>, text: string) {
    const svg = evt.currentTarget.closest('svg') as SVGSVGElement | null
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    setTooltip({ x: evt.clientX - rect.left, y: evt.clientY - rect.top, text })
  }

  function renderView(view: BodyView, xOffset: number) {
    const zones = BODY_ZONES.filter(z => z.view === view)

    return (
      <g transform={`translate(${xOffset}, 0)`}>
        {/* Ilustración. Se cambia la versión clara por la oscura según el tema:
            el dibujo es monocromo y una sola versión se pierde en uno de los dos. */}
        <image
          href={`/body/${view}-light.png`}
          x={0}
          y={0}
          width={VIEW_W}
          height={VIEW_H}
          preserveAspectRatio="xMidYMid meet"
          className="block dark:hidden"
          style={{ filter: `drop-shadow(0 1px 2px rgba(15,23,42,0.18))` }}
        />
        <image
          href={`/body/${view}-dark.png`}
          x={0}
          y={0}
          width={VIEW_W}
          height={VIEW_H}
          preserveAspectRatio="xMidYMid meet"
          className="hidden dark:block"
        />

        {zones.map(zone => {
          const injury = injuryByZone.get(zone.id)
          const isHovered = hovered === `${view}:${zone.id}`
          const color = injury ? SEVERITY_COLOR[injury.severity] : null
          const label = injury?.label ? `${zone.name} — ${injury.label}` : zone.name
          const cx = zone.x + zone.w / 2
          const cy = zone.y + zone.h / 2

          return (
            <g
              key={`${view}:${zone.id}`}
              onMouseEnter={e => { setHovered(`${view}:${zone.id}`); showTooltip(e, label) }}
              onMouseMove={e => showTooltip(e, label)}
              onMouseLeave={() => { setHovered(null); setTooltip(null) }}
              onClick={() => interactive && onZoneClick?.(zone.id)}
              style={{ cursor: interactive ? 'pointer' : 'default' }}
            >
              <rect
                x={zone.x} y={zone.y} width={zone.w} height={zone.h}
                rx={Math.min(zone.w, zone.h) * 0.35}
                fill={color ?? (isHovered ? 'rgba(99,102,241,0.28)' : 'transparent')}
                fillOpacity={color ? 0.5 : 1}
                stroke={color ?? (isHovered ? 'rgba(129,140,248,0.9)' : 'transparent')}
                strokeWidth={color ? 0.8 : 0.7}
                style={{ transition: 'fill 160ms ease, stroke 160ms ease' }}
              />
              {color && (
                <>
                  {/* Halo que late: hace que la lesión se encuentre de un vistazo. */}
                  <circle cx={cx} cy={cy} r={3.2} fill={color} opacity={0.35}>
                    <animate attributeName="r" values="3.2;6.4;3.2" dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.35;0;0.35" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                  <circle
                    cx={cx} cy={cy} r={2.6}
                    fill={color}
                    stroke="#fff" strokeWidth={0.9}
                    style={{ filter: `url(#body-dot-${uid})` }}
                  />
                </>
              )}
            </g>
          )
        })}

        <text
          x={VIEW_W / 2}
          y={VIEW_H + LABEL_H - 4}
          textAnchor="middle"
          className="fill-apple-gray-400 dark:fill-apple-gray-500"
          fontSize="6.5"
          fontWeight="700"
          letterSpacing="1.6"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          {view === 'front' ? 'FRENTE' : 'DORSO'}
        </text>
      </g>
    )
  }

  return (
    <div className={`relative select-none ${className}`}>
      <svg
        viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
        className="w-full max-w-sm mx-auto h-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id={`body-dot-${uid}`} x="-80%" y="-80%" width="260%" height="260%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor="#000" floodOpacity="0.45" />
          </filter>
        </defs>

        {renderView('front', 0)}
        {renderView('back', VIEW_W + GAP)}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-apple-gray-900/95 px-2.5 py-1.5 text-2xs font-semibold text-white shadow-lg dark:bg-apple-gray-700/95"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}

function severityRank(s: InjuryMark['severity']): number {
  return s === 'grave' ? 3 : s === 'moderada' ? 2 : 1
}

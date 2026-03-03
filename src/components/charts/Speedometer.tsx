interface SpeedometerProps {
  value: number
  label: string
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToCartesian(cx, cy, r, startDeg)
  const end = polarToCartesian(cx, cy, r, endDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

function getColor(value: number): string {
  if (value >= 70) return '#22C55E'
  if (value >= 55) return '#D97706'
  if (value >= 40) return '#F97316'
  return '#EF4444'
}

export default function Speedometer({ value, label }: SpeedometerProps) {
  const clampedValue = Math.max(0, Math.min(100, value))
  const cx = 90
  const cy = 80
  const r = 55
  const strokeW = 8

  const startDeg = 135
  const endDeg = 405
  const valueDeg = startDeg + (clampedValue / 100) * 270
  const color = getColor(clampedValue)

  // Needle
  const needleAngle = startDeg + (clampedValue / 100) * 270
  const needleRad = ((needleAngle - 90) * Math.PI) / 180
  const needleLen = r - 15

  const needleTip = {
    x: cx + needleLen * Math.cos(needleRad),
    y: cy + needleLen * Math.sin(needleRad),
  }

  const baseAngle1 = needleRad + Math.PI / 2
  const baseAngle2 = needleRad - Math.PI / 2
  const baseRadius = 4
  const base1 = {
    x: cx + baseRadius * Math.cos(baseAngle1),
    y: cy + baseRadius * Math.sin(baseAngle1),
  }
  const base2 = {
    x: cx + baseRadius * Math.cos(baseAngle2),
    y: cy + baseRadius * Math.sin(baseAngle2),
  }

  // Color zones
  const zones = [
    { start: 0, end: 40, color: '#EF4444' },
    { start: 40, end: 55, color: '#F97316' },
    { start: 55, end: 70, color: '#D97706' },
    { start: 70, end: 100, color: '#22C55E' },
  ]

  return (
    <div className="flex flex-col items-center w-full">
      {/* Label arriba del velocímetro */}
      <h4 className="text-base font-semibold text-apple-gray-800 dark:text-apple-gray-100 mb-2 capitalize tracking-tight">
        {label}
      </h4>

      <svg viewBox="0 0 180 150" className="w-full" style={{ maxWidth: '180px' }}>
        <defs>
          <filter id={`glow-${label.replace(/\s/g, '')}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Colored zone arcs (background) */}
        {zones.map((zone, i) => {
          const zoneStartDeg = startDeg + (zone.start / 100) * 270
          const zoneEndDeg = startDeg + (zone.end / 100) * 270
          return (
            <path
              key={i}
              d={arcPath(cx, cy, r, zoneStartDeg, zoneEndDeg)}
              stroke={zone.color}
              strokeWidth={strokeW + 6}
              fill="none"
              strokeLinecap="butt"
              opacity={0.15}
            />
          )
        })}

        {/* Main track */}
        <path
          d={arcPath(cx, cy, r, startDeg, endDeg)}
          className="stroke-apple-gray-200 dark:stroke-apple-gray-700"
          strokeWidth={strokeW}
          fill="none"
          strokeLinecap="round"
        />

        {/* Value arc with glow */}
        {clampedValue > 0 && (
          <path
            d={arcPath(cx, cy, r, startDeg, valueDeg)}
            stroke={color}
            strokeWidth={strokeW}
            fill="none"
            strokeLinecap="round"
            filter={`url(#glow-${label.replace(/\s/g, '')})`}
          />
        )}

        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map(v => {
          const deg = startDeg + (v / 100) * 270
          const inner = polarToCartesian(cx, cy, r + 5, deg)
          const outer = polarToCartesian(cx, cy, r + 10, deg)
          return (
            <line
              key={v}
              x1={inner.x.toFixed(2)}
              y1={inner.y.toFixed(2)}
              x2={outer.x.toFixed(2)}
              y2={outer.y.toFixed(2)}
              className="stroke-apple-gray-300 dark:stroke-apple-gray-600"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          )
        })}

        {/* Center decorative elements */}
        <circle
          cx={cx}
          cy={cy}
          r="10"
          className="fill-apple-gray-100 dark:fill-apple-gray-800"
        />
        <circle
          cx={cx}
          cy={cy}
          r="7"
          className="fill-white dark:fill-apple-gray-900"
        />

        {/* Needle */}
        <polygon
          points={`${needleTip.x.toFixed(2)},${needleTip.y.toFixed(2)} ${base1.x.toFixed(2)},${base1.y.toFixed(2)} ${base2.x.toFixed(2)},${base2.y.toFixed(2)}`}
          fill={color}
          className="drop-shadow-sm"
        />

        {/* Center cap */}
        <circle cx={cx} cy={cy} r="4" fill={color} />
        <circle cx={cx} cy={cy} r="1.5" className="fill-white/50" />

        {/* Value text */}
        <text
          x={cx}
          y={cy + 38}
          textAnchor="middle"
          fontSize="28"
          fontWeight="700"
          fill={color}
          className="tabular-nums"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}
        >
          {Math.round(clampedValue)}
        </text>
      </svg>
    </div>
  )
}

interface SubjectiveGroup {
  tipo: string
  averageScore: number
  attributes: Array<{ name: string; score: number }>
}

interface SpeedometerGroupProps {
  groups: SubjectiveGroup[]
}

export function SpeedometerGroup({ groups }: SpeedometerGroupProps) {
  if (groups.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
      {groups.map(group => (
        <div key={group.tipo} className="flex flex-col items-center">
          <Speedometer
            value={group.averageScore}
            label={group.tipo}
          />
        </div>
      ))}
    </div>
  )
}

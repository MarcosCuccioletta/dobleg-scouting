export default function VideoAnalysisCategoryChart({ data }: { data: { code: string; count: number }[] }) {
  const top = data.slice(0, 8)
  const max = top[0]?.count ?? 1

  return (
    <div>
      <p className="text-2xs text-apple-gray-400 mb-2">Qué acción se repite más en el rango elegido.</p>
      {top.length === 0 && <p className="text-xs text-apple-gray-400">Sin cortes en este rango.</p>}
      {top.map(row => (
        <div key={row.code} className="flex items-center gap-2 my-1.5">
          <span className="text-2xs text-apple-gray-600 dark:text-apple-gray-300 w-28 flex-shrink-0 truncate">{row.code}</span>
          <div className="flex-1 h-2.5 bg-apple-gray-100 dark:bg-apple-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand-green rounded-full" style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
          <span className="text-2xs text-apple-gray-400 w-6 text-right flex-shrink-0">{row.count}</span>
        </div>
      ))}
    </div>
  )
}

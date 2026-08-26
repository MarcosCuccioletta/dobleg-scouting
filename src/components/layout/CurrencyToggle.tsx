import { useRef, useState, useEffect } from 'react'
import { useCurrency } from '@/context/CurrencyContext'

const OPTIONS: { code: 'USD' | 'EUR'; symbol: string; label: string }[] = [
  { code: 'USD', symbol: '$', label: 'Dólar (USD)' },
  { code: 'EUR', symbol: '€', label: 'Euro (EUR)' },
]

export default function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Cambiar moneda"
        title="Cambiar moneda"
        className="relative p-2 rounded-lg bg-apple-gray-100 dark:bg-apple-gray-800 hover:bg-apple-gray-200 dark:hover:bg-apple-gray-700 transition-all duration-200 ease-apple group"
      >
        <svg className="w-5 h-5 text-apple-gray-600 dark:text-apple-gray-300 group-hover:text-apple-gray-800 dark:group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <ellipse cx="12" cy="7" rx="7" ry="3" strokeWidth="1.6" />
          <path d="M5 7v10c0 1.66 3.13 3 7 3s7-1.34 7-3V7" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-apple-gray-800 rounded-xl shadow-xl border border-apple-gray-200 dark:border-apple-gray-700 py-1 animate-scale-in origin-top-right z-50">
          {OPTIONS.map(opt => (
            <button
              key={opt.code}
              onClick={() => { setCurrency(opt.code); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                opt.code === currency
                  ? 'bg-brand-green/10 text-brand-green font-medium'
                  : 'text-apple-gray-700 dark:text-apple-gray-300 hover:bg-apple-gray-50 dark:hover:bg-apple-gray-700'
              }`}
            >
              <span className="w-4 text-center font-semibold">{opt.symbol}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

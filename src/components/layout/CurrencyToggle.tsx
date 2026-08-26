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
          <circle cx="12" cy="12" r="9" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="6.4" strokeWidth="1" strokeDasharray="1.4 1.8" opacity="0.6" />
          <path d="M12 6.8v10.4" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M14.6 9.3c0-1.1-1.2-2-2.6-2s-2.6.9-2.6 2 1.2 1.7 2.6 2 2.6.9 2.6 2-1.2 2-2.6 2-2.6-.9-2.6-2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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

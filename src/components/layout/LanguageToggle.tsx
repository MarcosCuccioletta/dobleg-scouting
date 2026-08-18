import { useRef, useState, useEffect } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { LANGUAGES } from '@/constants/translations'

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = LANGUAGES.find(l => l.code === language)!

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
        aria-label="Cambiar idioma"
        className="relative p-2 rounded-lg bg-apple-gray-100 dark:bg-apple-gray-800 hover:bg-apple-gray-200 dark:hover:bg-apple-gray-700 transition-all duration-200 ease-apple group"
      >
        <div className="relative w-5 h-5 flex items-center justify-center">
          <span className="text-sm leading-none">{current.flag}</span>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 max-h-80 overflow-y-auto bg-white dark:bg-apple-gray-800 rounded-xl shadow-xl border border-apple-gray-200 dark:border-apple-gray-700 py-1 animate-scale-in origin-top-right z-50">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => { setLanguage(l.code); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                l.code === language
                  ? 'bg-brand-green/10 text-brand-green font-medium'
                  : 'text-apple-gray-700 dark:text-apple-gray-300 hover:bg-apple-gray-50 dark:hover:bg-apple-gray-700'
              }`}
            >
              <span className="leading-none">{l.flag}</span>
              {l.nativeName}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

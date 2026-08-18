import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { translations, type Language } from '@/constants/translations'

export type { Language }

interface LanguageContextType {
  language: Language
  setLanguage: (l: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | null>(null)

const VALID_LANGUAGES = new Set(Object.keys(translations) as Language[])

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem('gg-language')
    return stored && VALID_LANGUAGES.has(stored as Language) ? (stored as Language) : 'es'
  })

  useEffect(() => {
    localStorage.setItem('gg-language', language)
  }, [language])

  // t() cae a español si la clave todavía no existe en el idioma activo — la
  // traducción se hace página por página, no todo de una, y esto evita que un
  // rollout parcial deje textos vacíos en vez de mostrar algo legible.
  const t = (key: string): string => translations[language][key] ?? translations.es[key] ?? key

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}

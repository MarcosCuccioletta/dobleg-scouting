import { Link } from 'react-router-dom'
import { useLanguage } from '@/context/LanguageContext'

export default function NotFoundPage() {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center animate-fade-in">
      <div className="w-24 h-24 bg-apple-gray-100 dark:bg-apple-gray-800 rounded-2xl flex items-center justify-center mb-6 shadow-apple dark:shadow-apple-dark">
        <svg className="w-12 h-12 text-apple-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-6xl font-bold text-apple-gray-200 dark:text-apple-gray-700 tracking-tight mb-2">404</p>
      <h1 className="text-xl font-semibold text-apple-gray-800 dark:text-white mb-2">{t('notFound.titulo')}</h1>
      <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400 max-w-sm leading-relaxed mb-6">
        {t('notFound.mensaje')}
      </p>
      <Link
        to="/"
        className="flex items-center gap-2 px-4 py-2.5 bg-brand-green text-white rounded-xl font-semibold text-sm hover:bg-emerald-600 active:scale-95 transition-all shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        {t('notFound.volver')} {t('nav.inicio')}
      </Link>
    </div>
  )
}

import { useCurrency } from '@/context/CurrencyContext'

export default function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency()

  const label = currency === 'USD' ? 'Cambiar a euros' : 'Cambiar a dólares'

  return (
    <button
      onClick={() => setCurrency(currency === 'USD' ? 'EUR' : 'USD')}
      aria-label={label}
      title={label}
      className="relative p-2 rounded-lg bg-apple-gray-100 dark:bg-apple-gray-800 hover:bg-apple-gray-200 dark:hover:bg-apple-gray-700 transition-all duration-200 ease-apple group"
    >
      <svg className="w-5 h-5 text-apple-gray-600 dark:text-apple-gray-300 group-hover:text-apple-gray-800 dark:group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="9" strokeWidth="1.6" />
        {currency === 'USD' ? (
          <path d="M12 6.5v11M14.8 9c0-1.1-1.3-2-2.8-2s-2.8.9-2.8 2 1.3 1.6 2.8 2 2.8.9 2.8 2-1.3 2-2.8 2-2.8-.9-2.8-2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M15 8.3c-.7-.8-1.8-1.3-3-1.3-2.3 0-4.2 1.8-4.2 4v2c0 2.2 1.9 4 4.2 4 1.2 0 2.3-.5 3-1.3M7 10.5h5.5M7 13.5h5.5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  )
}

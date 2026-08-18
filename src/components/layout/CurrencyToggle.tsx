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
      <div className="relative w-5 h-5 flex items-center justify-center">
        <span className="text-sm font-bold text-apple-gray-600 dark:text-apple-gray-300 group-hover:text-apple-gray-800 dark:group-hover:text-white transition-colors duration-200 ease-apple">
          {currency === 'USD' ? '$' : '€'}
        </span>
      </div>
    </button>
  )
}

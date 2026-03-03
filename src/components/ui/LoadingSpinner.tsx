import { useTheme } from '@/context/ThemeContext'

interface LoadingSpinnerProps {
  message?: string
  fullScreen?: boolean
}

export default function LoadingSpinner({ message, fullScreen = false }: LoadingSpinnerProps) {
  const { theme } = useTheme()

  // Default message for fullscreen loading
  const displayMessage = message ?? (fullScreen ? 'Cargando Doble G Scout Platform' : 'Cargando datos...')

  const content = (
    <div className="flex flex-col items-center gap-6 animate-fade-in">
      {/* Logo pulse animation */}
      <div className="relative">
        <div className="absolute inset-0 w-24 h-24 bg-brand-green/20 rounded-full animate-ping" />
        <div className="relative w-24 h-24 flex items-center justify-center">
          <img
            src={theme === 'dark' ? '/logo-light.png' : '/logo-dark.png'}
            alt="Loading"
            className="w-20 h-20 object-contain animate-pulse-soft"
          />
        </div>
      </div>
      <div className="flex flex-col items-center gap-3">
        <p className="text-base font-semibold text-apple-gray-700 dark:text-apple-gray-200">{displayMessage}</p>
        {/* Apple-style loading dots */}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-brand-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-brand-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-brand-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-apple-gray-50 dark:bg-apple-gray-900 z-50">
        {content}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-20">
      {content}
    </div>
  )
}

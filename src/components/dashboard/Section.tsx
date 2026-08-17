interface SectionProps {
  title: string
  children: React.ReactNode
  action?: { label: string; onClick: () => void }
}

export default function Section({ title, children, action }: SectionProps) {
  return (
    <div className="bg-white dark:bg-apple-gray-800 rounded-xl border border-apple-gray-200 dark:border-apple-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-apple-gray-100 dark:border-apple-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-apple-gray-800 dark:text-white">{title}</h3>
        {action && (
          <button
            onClick={action.onClick}
            className="text-xs font-medium text-brand-green hover:underline"
          >
            {action.label}
          </button>
        )}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}

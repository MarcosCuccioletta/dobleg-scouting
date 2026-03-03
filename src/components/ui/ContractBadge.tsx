interface ContractBadgeProps {
  status: 'ok' | 'warning' | 'critical'
  monthsRemaining: number | null
  showTooltip?: boolean
}

export default function ContractBadge({ status, monthsRemaining, showTooltip = true }: ContractBadgeProps) {
  if (status === 'ok') return null

  const isWarning = status === 'warning'
  const label = monthsRemaining !== null
    ? `Contrato: ${monthsRemaining} mes${monthsRemaining !== 1 ? 'es' : ''} restante${monthsRemaining !== 1 ? 's' : ''}`
    : 'Contrato por vencer'

  return (
    <span
      title={showTooltip ? label : undefined}
      className={`relative inline-flex items-center justify-center w-1.5 h-1.5 rounded-full flex-shrink-0 ml-1.5 ${
        isWarning
          ? 'bg-amber-400'
          : 'bg-orange-500'
      }`}
      aria-label={label}
    >
      <span
        className={`absolute inset-0 rounded-full animate-ping ${
          isWarning ? 'bg-amber-400' : 'bg-orange-500'
        } opacity-40`}
        style={{ animationDuration: '2.5s' }}
      />
    </span>
  )
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  color = '#B85C7A',
  change = null,
  subtitle = null,
  className = '',
}) {
  return (
    <div className={`card hover:shadow-card-hover transition-all duration-200 flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-textSecondary">{title}</span>
        {Icon && (
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-border/50"
            style={{
              backgroundColor: `${color}20`,
              color: color,
            }}
          >
            <Icon className="w-5 h-5 stroke-[2]" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-heading font-bold text-3xl text-textPrimary tracking-tight">
          {value !== undefined && value !== null ? value : '-'}
        </span>
        {change && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              change.startsWith('+')
                ? 'bg-success/10 text-success'
                : change.startsWith('-')
                ? 'bg-error/10 text-error'
                : 'bg-textSecondary/10 text-textSecondary'
            }`}
          >
            {change}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1.5 text-xs text-textSecondary font-normal">
          {subtitle}
        </p>
      )}
    </div>
  )
}

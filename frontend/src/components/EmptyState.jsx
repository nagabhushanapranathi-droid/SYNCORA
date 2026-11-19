import { Inbox } from 'lucide-react'

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'No items found',
  description = 'There are no records to display at this moment.',
  actionLabel = '',
  onAction = null,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 ${className}`}>
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-accent mb-4 border border-border shadow-sm">
        <Icon className="w-8 h-8 stroke-[1.75]" />
      </div>
      <h3 className="text-lg font-semibold text-textPrimary mb-1">
        {title}
      </h3>
      <p className="text-sm text-textSecondary max-w-sm mb-5">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn-primary text-sm shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

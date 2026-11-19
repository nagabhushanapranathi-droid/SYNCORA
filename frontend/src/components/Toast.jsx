import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

export default function Toast({
  message,
  type = 'info',
  onClose,
  className = '',
}) {
  if (!message) return null

  let border = 'border-border'
  let icon = <Info className="w-5 h-5 text-info shrink-0" />

  if (type === 'success') {
    border = 'border-success/30'
    icon = <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
  } else if (type === 'error') {
    border = 'border-error/30'
    icon = <AlertCircle className="w-5 h-5 text-error shrink-0" />
  } else if (type === 'warning') {
    border = 'border-warning/30'
    icon = <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
  }

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl shadow-card-hover border bg-white ${border} transition-all duration-300 ${className}`}
      role="alert"
    >
      {icon}
      <div className="flex-1 text-sm font-medium text-textPrimary break-words">
        {message}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-textSecondary hover:text-textPrimary transition-colors"
          aria-label="Close alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

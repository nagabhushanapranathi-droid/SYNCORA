import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

// Inline (non-floating) alert. Floating toasts live in ToastContext.
const TONES = {
  success: ['ground-verified', CheckCircle2, 'text-ok-ink'],
  error: ['bg-danger-soft border border-danger/30', AlertCircle, 'text-danger-ink'],
  warning: ['bg-warn-soft border border-warn', AlertTriangle, 'text-warn-ink'],
  info: ['bg-info-soft border border-info', Info, 'text-info-ink'],
}

export default function Toast({ message, type = 'info', onClose, className = '' }) {
  if (!message) return null
  const [box, Icon, ink] = TONES[type] || TONES.info
  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-panel ${box} ${className}`} role="alert">
      <Icon className={`w-5 h-5 shrink-0 ${ink}`} />
      <div className="flex-1 text-base font-medium text-ink break-words">{message}</div>
      {onClose && (
        <button onClick={onClose} className="btn-icon w-7 h-7" aria-label="Dismiss alert">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

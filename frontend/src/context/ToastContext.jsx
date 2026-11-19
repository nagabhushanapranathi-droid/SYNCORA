import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

const ToastContext = createContext(null)

const TONES = {
  success: { icon: CheckCircle2, cls: 'text-ok-ink', bar: 'bg-ok' },
  error: { icon: AlertCircle, cls: 'text-danger-ink', bar: 'bg-danger' },
  warning: { icon: AlertTriangle, cls: 'text-warn-ink', bar: 'bg-warn' },
  info: { icon: Info, cls: 'text-info-ink', bar: 'bg-info' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (message, type = 'info', duration = 4200) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setToasts((prev) => [...prev.slice(-3), { id, message, type }])
      if (duration > 0) setTimeout(() => removeToast(id), duration)
    },
    [removeToast]
  )

  const toast = useMemo(
    () => ({
      success: (msg, dur) => addToast(msg, 'success', dur),
      error: (msg, dur) => addToast(msg, 'error', dur ?? 6000),
      warning: (msg, dur) => addToast(msg, 'warning', dur),
      info: (msg, dur) => addToast(msg, 'info', dur),
    }),
    [addToast]
  )

  const value = useMemo(() => ({ toast, addToast, removeToast }), [toast, addToast, removeToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed z-[60] bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 sm:w-[380px] pointer-events-none no-print"
        aria-live="polite"
        role="status"
      >
        {toasts.map((t) => {
          const tone = TONES[t.type] || TONES.info
          const Icon = tone.icon
          return (
            <div
              key={t.id}
              className="pointer-events-auto relative overflow-hidden flex items-start gap-3 py-3 pl-4 pr-3 rounded-panel bg-surface border border-line shadow-pop animate-slide-in-right"
            >
              <span className={`absolute left-0 inset-y-0 w-1 ${tone.bar}`} aria-hidden="true" />
              <Icon className={`w-5 h-5 shrink-0 mt-px ${tone.cls}`} />
              <p className="flex-1 text-base font-medium text-ink break-words">{t.message}</p>
              <button onClick={() => removeToast(t.id)} className="btn-icon w-7 h-7 -mr-1" aria-label="Dismiss notification">
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context.toast
}

export default ToastContext

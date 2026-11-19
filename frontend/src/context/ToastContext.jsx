import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 5)
    setToasts((prev) => [...prev, { id, message, type }])

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [removeToast])

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info: (msg, dur) => addToast(msg, 'info', dur)
  }

  return (
    <ToastContext.Provider value={{ toast, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          let bg = 'bg-white'
          let border = 'border-border'
          let icon = <Info className="w-5 h-5 text-info shrink-0" />
          let text = 'text-textPrimary'

          if (t.type === 'success') {
            border = 'border-success/30'
            icon = <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          } else if (t.type === 'error') {
            border = 'border-error/30'
            icon = <AlertCircle className="w-5 h-5 text-error shrink-0" />
          } else if (t.type === 'warning') {
            border = 'border-warning/30'
            icon = <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-card-hover border ${bg} ${border} animate-slide-up transition-all duration-300`}
            >
              {icon}
              <div className={`flex-1 text-sm font-medium ${text} break-words`}>
                {t.message}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-textSecondary hover:text-textPrimary transition-colors"
                aria-label="Close notification"
              >
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
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context.toast
}

export default ToastContext

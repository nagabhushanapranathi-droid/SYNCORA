import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * Accessible dialog: labelled, Escape to close, focus moved in and restored on close,
 * Tab kept inside. Renders as a bottom sheet on small screens.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle = '',
  children,
  footer = null,
  maxWidth = 'max-w-lg',
  closeDisabled = false,
}) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const lastFocused = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return
    lastFocused.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusFirst = () => {
      const el = dialogRef.current?.querySelector(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([data-close]), [href], [tabindex]:not([tabindex="-1"])'
      )
      ;(el || dialogRef.current)?.focus()
    }
    const t = setTimeout(focusFirst, 30)

    const onKey = (e) => {
      if (e.key === 'Escape' && !closeDisabled) {
        e.stopPropagation()
        onCloseRef.current?.()
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const nodes = dialogRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (!nodes.length) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      lastFocused.current?.focus?.()
    }
  }, [isOpen, closeDisabled])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      <div
        className="absolute inset-0 bg-[rgb(40_28_30/0.42)] dark:bg-[rgb(6_4_10/0.7)] animate-fade"
        onClick={closeDisabled ? undefined : onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full ${maxWidth} max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-surface border border-line shadow-pop
          rounded-t-sheet sm:rounded-sheet animate-pop-in focus:outline-none`}
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-line">
          <div className="min-w-0">
            <h2 id={titleId} className="font-heading font-extrabold text-lg text-ink">
              {title}
            </h2>
            {subtitle && <p className="text-sm text-ink-2 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            disabled={closeDisabled}
            className="btn-icon -mr-2 -mt-1"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 sm:px-6 py-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-5 sm:px-6 py-4 border-t border-line bg-surface-2/60 flex flex-wrap items-center justify-end gap-2.5 rounded-b-sheet">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

import { Inbox } from 'lucide-react'
import { StickerScatter } from './motifs'
import Mascot from './Mascot'

/**
 * Empty screens are an invitation to act: say what is missing and what to do next.
 * `mascot` swaps the sticker tile for Cora (use sparingly — major empties only).
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description = '',
  actionLabel = '',
  onAction = null,
  action = null,
  mascot = false,
  compact = false,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'px-4 py-6' : 'px-6 py-10 sm:py-12'} ${className}`}>
      {mascot ? (
        <Mascot size={compact ? 56 : 76} mood="idle" className="mb-3" />
      ) : (
        <div className={`relative ${compact ? 'mb-3' : 'mb-4'}`}>
          <div
            className={`${compact ? 'w-11 h-11' : 'w-14 h-14'} rounded-panel bg-surface-2 border border-line flex items-center justify-center text-ink-2 rotate-[-4deg]`}
          >
            <Icon className={compact ? 'w-5 h-5' : 'w-6 h-6'} strokeWidth={1.8} />
          </div>
          {!compact && <StickerScatter />}
        </div>
      )}
      <h3 className={`font-heading font-bold text-ink ${compact ? 'text-base' : 'text-md'}`}>{title}</h3>
      {description && <p className="text-sm text-ink-2 max-w-sm mt-1">{description}</p>}
      {(action || (actionLabel && onAction)) && (
        <div className="mt-4">
          {action || (
            <button type="button" onClick={onAction} className="btn-primary btn-sm">
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

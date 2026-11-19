// Loading indicators. Prefer <Skeleton> for content regions and <LoadingSpinner> for
// short waits (route guard, dialogs).
export default function LoadingSpinner({ message = '', size = 'md', className = '' }) {
  const dims = { sm: 'w-5 h-5 border-2', md: 'w-8 h-8 border-[3px]', lg: 'w-11 h-11 border-4' }[size] || 'w-8 h-8 border-[3px]'
  return (
    <div className={`flex flex-col items-center justify-center p-6 ${className}`} role="status" aria-live="polite">
      <div className={`${dims} rounded-full border-line-strong border-t-accent animate-spin`} />
      <span className={message ? 'mt-3 text-sm font-medium text-ink-2' : 'sr-only'}>{message || 'Loading'}</span>
    </div>
  )
}

export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

/** A block of skeleton rows used while a list loads. */
export function SkeletonRows({ rows = 4, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

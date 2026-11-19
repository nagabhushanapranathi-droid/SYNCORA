// Shared layout primitives used across every SYNCORA page.
import { RefreshCw, Search } from 'lucide-react'
import Mascot from './Mascot'
import { initials } from '../lib/format'

/** Page title block: one H1 per page, optional description and actions. */
export function PageHeader({ title, description, actions, children }) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
      <div className="min-w-0">
        <h1 className="font-heading font-extrabold text-2xl sm:text-[1.9rem] leading-tight text-ink">{title}</h1>
        {description && <p className="mt-1.5 text-base text-ink-2 max-w-2xl">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 md:justify-end shrink-0">{actions}</div>}
    </header>
  )
}

/** Header row inside a sheet. */
export function SheetHeader({ title, description, icon: Icon, actions, className = '' }) {
  return (
    <div className={`sheet-head ${className}`}>
      <div className="flex items-start gap-2.5 min-w-0">
        {Icon && (
          <span className="mt-0.5 text-ink-3 shrink-0">
            <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="sheet-title">{title}</h2>
          {description && <p className="sheet-sub mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

/** A controlled failure message with a retry. Never replaces data with invented values. */
export function ErrorState({ title = 'This section could not load', message, onRetry, compact = false }) {
  return (
    <div className={`flex ${compact ? 'flex-row items-center gap-3 p-4' : 'flex-col items-center text-center px-6 py-10'}`} role="alert">
      <Mascot size={compact ? 40 : 64} mood="worried" className={compact ? 'shrink-0' : 'mb-3'} />
      <div className={compact ? 'flex-1 min-w-0' : ''}>
        <p className="font-heading font-bold text-ink">{title}</p>
        {message && <p className="text-sm text-ink-2 mt-0.5">{message}</p>}
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`btn-secondary btn-sm ${compact ? '' : 'mt-4'}`}>
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
      )}
    </div>
  )
}

/** Segmented control / tab strip. options: [{ id, label, count? }] */
export function Segmented({ options, value, onChange, label = 'Filter', className = '' }) {
  return (
    <div className={`seg ${className}`} role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className="seg-item"
        >
          {o.icon && <o.icon className="w-3.5 h-3.5" />}
          {o.label}
          {o.count !== undefined && (
            <span className="tabular text-2xs font-bold rounded-full px-1.5 min-w-[1.25rem] text-center bg-surface-3 text-ink-2">
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, htmlFor, hint, error, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="field-label">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search', label = 'Search', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9"
      />
    </div>
  )
}

const AVATAR_TONES = ['bg-accent-soft text-accent-ink', 'bg-ok-soft text-ok-ink', 'bg-warn-soft text-warn-ink', 'bg-info-soft text-info-ink']

export function Avatar({ name, size = 'md', className = '' }) {
  const dims = { xs: 'w-6 h-6 text-[10px]', sm: 'w-8 h-8 text-2xs', md: 'w-9 h-9 text-xs', lg: 'w-12 h-12 text-sm', xl: 'w-16 h-16 text-lg' }[size]
  const sum = String(name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return (
    <span className={`avatar ${dims} ${AVATAR_TONES[sum % AVATAR_TONES.length]} ${className}`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}

/** Label/value pair for detail panels. */
export function Meta({ label, children, className = '' }) {
  return (
    <div className={className}>
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="mt-0.5 font-semibold text-ink break-words">{children ?? '—'}</dd>
    </div>
  )
}

/** Inline score bar (0–max). */
export function Meter({ value = 0, max = 100, tone = 'accent', label }) {
  const w = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const bar = { accent: 'bg-accent', ok: 'bg-ok', warn: 'bg-warn', info: 'bg-info', ink: 'bg-ink-3' }[tone] || 'bg-accent'
  return (
    <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className={`h-full rounded-full ${bar} transition-[width] duration-500`} style={{ width: `${w}%` }} />
    </div>
  )
}

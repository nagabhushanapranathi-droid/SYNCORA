// Original decorative motifs for both themes. All are inline SVG using currentColor
// (or explicit token colours) so they stay tiny and theme-aware.
import { useTheme } from '../context/ThemeContext'

export function Bow({ className = 'w-6 h-6', title }) {
  return (
    <svg viewBox="0 0 32 24" className={className} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d="M15 12C10.5 5 2.5 4.5 2.5 10.5 2.5 16.5 10.5 17 15 12Z" fill="currentColor" />
      <path d="M17 12c4.5-7 12.5-7.5 12.5-1.5S21.5 17 17 12Z" fill="currentColor" />
      <path d="M14.3 13.3 11.5 21l2.6-1 1.4 2.4.7-8.6Z" fill="currentColor" opacity=".75" />
      <path d="m17.7 13.3 2.8 7.7-2.6-1-1.4 2.4-.7-8.6Z" fill="currentColor" opacity=".75" />
      <circle cx="16" cy="12" r="3.1" fill="currentColor" />
      <circle cx="15" cy="11" r=".9" fill="#fff" opacity=".55" />
    </svg>
  )
}

export function Sparkle({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 1.5c.6 4.9 2.6 8.9 10.5 10.5-7.9 1.6-9.9 5.6-10.5 10.5C11.4 17.6 9.4 13.6 1.5 12 9.4 10.4 11.4 6.4 12 1.5Z" fill="currentColor" />
    </svg>
  )
}

export function Flower({ className = 'w-5 h-5', center = 'rgb(var(--warn))' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {[0, 72, 144, 216, 288].map((r) => (
        <ellipse key={r} cx="12" cy="6.4" rx="3.6" ry="4.6" fill="currentColor" transform={`rotate(${r} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="3" fill={center} />
    </svg>
  )
}

export function Moon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M15.5 2.5a9.5 9.5 0 1 0 6 16.8A8 8 0 0 1 15.5 2.5Z" fill="currentColor" />
    </svg>
  )
}

/** A small, friendly skull — the Midnight theme's signature sticker. */
export function Skull({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2.5c-5 0-8.5 3.4-8.5 8 0 2.6 1.2 4.4 2.9 5.4v2.4c0 1 .8 1.7 1.7 1.7h7.8c1 0 1.7-.8 1.7-1.7v-2.4c1.7-1 2.9-2.8 2.9-5.4 0-4.6-3.5-8-8.5-8Z"
        fill="currentColor"
      />
      <ellipse cx="8.8" cy="11" rx="2.1" ry="2.4" fill="rgb(var(--canvas))" />
      <ellipse cx="15.2" cy="11" rx="2.1" ry="2.4" fill="rgb(var(--canvas))" />
      <path d="M12 13.6l-1.1 1.9h2.2Z" fill="rgb(var(--canvas))" />
      <path d="M9.6 17.4v2.2M12 17.4v2.2M14.4 17.4v2.2" stroke="rgb(var(--canvas))" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}

/** Theme-specific signature: a bow by day, a skull after dark. */
export function SignatureMotif({ className }) {
  const { theme } = useTheme()
  return theme === 'dark' ? <Skull className={className} /> : <Bow className={className} />
}

/**
 * Scattered stickers around an empty-state tile. Light: bows, flowers, sparkles.
 * Dark: moon, stars, a skull. Purely decorative.
 */
export function StickerScatter() {
  const { theme } = useTheme()
  if (theme === 'dark') {
    return (
      <>
        <Moon className="absolute -top-2 -right-3 w-5 h-5 text-info rotate-12" />
        <Sparkle className="absolute -bottom-1 -left-3 w-3.5 h-3.5 text-brand-2" />
        <Skull className="absolute -top-3 -left-2 w-4 h-4 text-brand -rotate-12" />
        <Sparkle className="absolute bottom-2 -right-4 w-2.5 h-2.5 text-ink-3" />
      </>
    )
  }
  return (
    <>
      <Bow className="absolute -top-3 -right-4 w-7 h-5 text-brand rotate-12" />
      <Flower className="absolute -bottom-2 -left-3 w-4 h-4 text-brand-2" />
      <Sparkle className="absolute -top-2 -left-3 w-3 h-3 text-warn" />
      <Sparkle className="absolute bottom-1 -right-3 w-2.5 h-2.5 text-info" />
    </>
  )
}

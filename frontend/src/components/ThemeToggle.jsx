import { useTheme } from '../context/ThemeContext'
import { Bow, Moon } from './motifs'

/**
 * Two-position switch between Ribbon (light, bow) and Midnight (dark, moon).
 * `system` preference is offered in Settings / Profile; this switch sets an explicit choice.
 */
export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={toggle}
      title={dark ? 'Switch to Ribbon (light) theme' : 'Switch to Midnight (dark) theme'}
      aria-label="Midnight (dark) theme"
      className={`relative inline-flex items-center h-9 w-[68px] rounded-full border border-line-strong bg-surface-2 px-1 transition-colors hover:border-accent/50 ${className}`}
    >
      <span
        className={`absolute top-1 left-1 h-7 w-7 rounded-full shadow-sheet transition-transform duration-200 ease-out ${
          dark ? 'translate-x-[30px] bg-surface-3' : 'translate-x-0 bg-surface'
        }`}
        aria-hidden="true"
      />
      <span className="relative z-10 flex w-full items-center justify-between px-[5px]" aria-hidden="true">
        <Bow className={`w-[18px] h-[14px] transition-colors ${dark ? 'text-ink-3' : 'text-brand'}`} />
        <Moon className={`w-4 h-4 transition-colors ${dark ? 'text-accent' : 'text-ink-3'}`} />
      </span>
    </button>
  )
}

/** Three-way preference selector used on Settings and Profile pages. */
export function ThemePreference() {
  const { preference, setPreference } = useTheme()
  const options = [
    { id: 'light', title: 'Ribbon', note: 'Light — vanilla paper and cherry ribbon' },
    { id: 'dark', title: 'Midnight', note: 'Dark — plum pages and lavender ink' },
    { id: 'system', title: 'Match device', note: 'Follow your system setting' },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
      {options.map((o) => {
        const active = preference === o.id
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(o.id)}
            className={`text-left rounded-panel border p-3 transition-colors ${
              active ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong bg-surface'
            }`}
          >
            <ThemeSwatch kind={o.id} />
            <span className="mt-2.5 block font-heading font-bold text-ink">{o.title}</span>
            <span className="block text-xs text-ink-2">{o.note}</span>
          </button>
        )
      })}
    </div>
  )
}

function ThemeSwatch({ kind }) {
  const light = (
    <div className="h-full w-full bg-[#FFF9EF] p-1.5 flex gap-1">
      <div className="w-3 rounded-sm bg-white border border-[#F0E2D2]" />
      <div className="flex-1 space-y-1">
        <div className="h-1.5 w-8 rounded-full bg-[#D95763]" />
        <div className="h-4 rounded-sm bg-white border border-[#F0E2D2]" />
        <div className="h-1.5 w-6 rounded-full bg-[#B9D8C2]" />
      </div>
    </div>
  )
  const dark = (
    <div className="h-full w-full bg-[#17141F] p-1.5 flex gap-1">
      <div className="w-3 rounded-sm bg-[#120F19] border border-[#443950]" />
      <div className="flex-1 space-y-1">
        <div className="h-1.5 w-8 rounded-full bg-[#D8C9E8]" />
        <div className="h-4 rounded-sm bg-[#211C2B] border border-[#443950]" />
        <div className="h-1.5 w-6 rounded-full bg-[#F4A6A6]" />
      </div>
    </div>
  )
  return (
    <div className="h-14 rounded-md overflow-hidden border border-line flex" aria-hidden="true">
      {kind === 'light' && light}
      {kind === 'dark' && dark}
      {kind === 'system' && (
        <>
          <div className="w-1/2 overflow-hidden">{light}</div>
          <div className="w-1/2 overflow-hidden">{dark}</div>
        </>
      )}
    </div>
  )
}

import { Menu, CalendarDays } from 'lucide-react'
import NotificationBell from './NotificationBell'
import ThemeToggle from './ThemeToggle'
import { SignatureMotif } from './motifs'

export default function TopBar({ role = 'admin', onMenu }) {
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <header className="h-16 shrink-0 bg-chrome/90 border-b border-line px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 z-20 no-print">
      <div className="flex items-center gap-2 min-w-0">
        <button type="button" onClick={onMenu} className="btn-icon lg:hidden -ml-1" aria-label="Open navigation">
          <Menu className="w-5 h-5" />
        </button>
        <span className="lg:hidden flex items-center gap-1.5 text-brand">
          <SignatureMotif className="w-6 h-5" />
          <span className="font-heading font-black tracking-[0.04em] text-ink">SYNCORA</span>
        </span>
        <p className="hidden lg:flex items-center gap-2 text-sm text-ink-2">
          <CalendarDays className="w-4 h-4 text-ink-3" />
          <span>
            Today is <span className="font-semibold text-ink">{today}</span>
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <ThemeToggle />
        <NotificationBell userRole={role} />
      </div>
    </header>
  )
}

import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

export default function TopBar({ title, subtitle = '', role = 'admin' }) {
  const { user } = useAuth()
  const displayName = user?.name || (role === 'admin' ? 'Administrator' : 'Faculty Member')
  const userInitials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  return (
    <header className="h-16 bg-white border-b border-border px-6 flex items-center justify-between shrink-0 shadow-sm z-20">
      <div>
        <h2 className="font-heading font-bold text-lg text-textPrimary leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-textSecondary">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <NotificationBell userRole={role} />

        <div className="h-6 w-px bg-border hidden sm:block" />

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-secondary text-accent font-heading font-semibold text-xs flex items-center justify-center border border-border shrink-0">
            {userInitials}
          </div>
          <div className="hidden sm:block text-left">
            <span className="block text-xs font-semibold text-textPrimary leading-none">
              {displayName}
            </span>
            <span className="block text-[10px] text-textSecondary uppercase mt-0.5">
              {user?.department?.name || user?.department_name || (role === 'admin' ? 'System Admin' : 'Faculty')}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

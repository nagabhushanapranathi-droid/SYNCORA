import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  UserX,
  ArrowLeftRight,
  Sparkles,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  Layers,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function Sidebar({ role = 'admin' }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const adminLinks = [
    { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/admin/faculty', label: 'Faculty', icon: Users },
    { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
    { to: '/admin/timetable', label: 'Timetable', icon: CalendarDays },
    { to: '/admin/absences', label: 'Absences', icon: UserX },
    { to: '/admin/substitutions', label: 'Substitutions', icon: ArrowLeftRight },
    { to: '/admin/ai-assistant', label: 'AI Assistant', icon: Sparkles },
    { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ]

  const facultyLinks = [
    { to: '/faculty/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/faculty/timetable', label: 'My Timetable', icon: CalendarDays },
    { to: '/faculty/substitutions', label: 'My Substitutions', icon: ArrowLeftRight },
    { to: '/faculty/notifications', label: 'Notifications', icon: Bell },
  ]

  const links = role === 'admin' ? adminLinks : facultyLinks

  const handleLogout = async () => {
    try {
      await logout()
      toast.info('Logged out successfully')
      navigate('/login')
    } catch {
      navigate('/login')
    }
  }

  const displayName = user?.name || (role === 'admin' ? 'Administrator' : 'Faculty Member')
  const displayRole = (user?.role || role).toUpperCase()
  const userInitials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  return (
    <aside className="w-64 h-screen bg-sidebar flex flex-col justify-between border-r border-border shadow-sidebar shrink-0 select-none">
      {/* Brand Header */}
      <div>
        <div className="p-6 pb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center shadow-md">
            <Layers className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-xl tracking-wide text-accent">
              SYNCORA
            </h1>
            <p className="text-[11px] font-medium text-textSecondary uppercase tracking-wider">
              {role === 'admin' ? 'Admin Portal' : 'Faculty Portal'}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 mt-4 space-y-1">
          {links.map((link) => {
            const Icon = link.icon
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active shadow-sm font-semibold' : ''}`
                }
              >
                <Icon className="w-4 h-4 shrink-0 stroke-[2]" />
                <span className="truncate">{link.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>

      {/* User Info & Logout Footer */}
      <div className="p-4 border-t border-border/80 bg-sidebar">
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/70 border border-border/70 mb-3">
          <div className="w-9 h-9 rounded-full bg-accent/15 text-accent font-heading font-bold text-xs flex items-center justify-center shrink-0">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-textPrimary truncate">
              {displayName}
            </p>
            <p className="text-[10px] text-textSecondary truncate">
              {displayRole}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium text-textSecondary hover:text-error hover:bg-error/10 transition-colors duration-200"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}

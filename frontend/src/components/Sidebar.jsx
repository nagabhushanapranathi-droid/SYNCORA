import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  UserX,
  ArrowLeftRight,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  Library,
  MessageCircleHeart,
  UserRound,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { SignatureMotif } from './motifs'
import { Avatar } from './ui'

export const NAV = {
  admin: [
    {
      group: 'Today',
      links: [
        { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
        { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
        { to: '/admin/absences', label: 'Absences', icon: UserX },
        { to: '/admin/substitutions', label: 'Substitutions', icon: ArrowLeftRight },
      ],
    },
    {
      group: 'Planning',
      links: [
        { to: '/admin/timetable', label: 'Timetable', icon: CalendarDays },
        { to: '/admin/faculty', label: 'Faculty', icon: Users },
        { to: '/admin/academics', label: 'Departments & subjects', icon: Library },
      ],
    },
    {
      group: 'Insight',
      links: [
        { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
        { to: '/admin/assistant', label: 'Ask Cora', icon: MessageCircleHeart },
      ],
    },
    {
      group: 'You',
      links: [
        { to: '/admin/notifications', label: 'Notifications', icon: Bell },
        { to: '/admin/settings', label: 'Settings', icon: Settings },
      ],
    },
  ],
  faculty: [
    {
      group: 'Today',
      links: [
        { to: '/faculty/dashboard', label: 'My day', icon: LayoutDashboard },
        { to: '/faculty/timetable', label: 'My timetable', icon: CalendarDays },
        { to: '/faculty/substitutions', label: 'Cover duties', icon: ArrowLeftRight },
      ],
    },
    {
      group: 'Help',
      links: [{ to: '/faculty/assistant', label: 'Ask Cora', icon: MessageCircleHeart }],
    },
    {
      group: 'You',
      links: [
        { to: '/faculty/notifications', label: 'Notifications', icon: Bell },
        { to: '/faculty/profile', label: 'Profile', icon: UserRound },
      ],
    },
  ],
}

export default function Sidebar({ role = 'admin', onNavigate, onClose, mobile = false }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const groups = NAV[role] || NAV.faculty

  const handleLogout = async () => {
    await logout()
    toast.info('You have been signed out.')
    navigate('/login')
  }

  const displayName = user?.name || (role === 'admin' ? 'Administrator' : 'Faculty member')

  return (
    <aside
      className={`w-[264px] h-full bg-chrome border-r border-line flex flex-col ${mobile ? 'shadow-pop' : ''}`}
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-between gap-2 px-6 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <span className="text-brand">
            <SignatureMotif className="w-8 h-6" />
          </span>
          <div className="leading-none">
            <span className="block font-heading font-black text-[1.32rem] tracking-[0.04em] text-ink">SYNCORA</span>
            <span className="block mt-1 text-xs text-ink-2">{role === 'admin' ? 'Admin office' : 'Faculty desk'}</span>
          </div>
        </div>
        {mobile && (
          <button type="button" onClick={onClose} className="btn-icon" aria-label="Close navigation">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto pb-4">
        {groups.map((g) => (
          <div key={g.group} className="mb-4">
            <p className="px-8 mb-1.5 text-xs font-semibold text-ink-3">{g.group}</p>
            <ul className="space-y-0.5">
              {g.links.map((link) => {
                const Icon = link.icon
                return (
                  <li key={link.to}>
                    <NavLink to={link.to} onClick={onNavigate} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                      <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
                      <span className="truncate">{link.label}</span>
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-line">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <Avatar name={displayName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-ink truncate">{displayName}</p>
            <p className="text-xs text-ink-2 truncate">{user?.email}</p>
          </div>
        </div>
        <button type="button" onClick={handleLogout} className="btn-ghost w-full mt-2 justify-start px-3 h-9 text-sm">
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}

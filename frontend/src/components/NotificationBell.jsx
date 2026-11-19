import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { notificationService } from '../services/notificationService'
import { asList, relativeTime } from '../lib/format'
import { CATEGORIES, categorize, isRead } from '../lib/notifications'

export default function NotificationBell({ userRole = 'faculty' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [ring, setRing] = useState(false)
  const prevUnread = useRef(null)
  const ref = useRef(null)

  const unreadCount = notifications.filter((n) => !isRead(n)).length

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationService.getAll()
      const list = asList(data, 'notifications')
      setNotifications(list)
      setFailed(false)
      const unread = list.filter((n) => !isRead(n)).length
      if (prevUnread.current !== null && unread > prevUnread.current) {
        setRing(true)
        setTimeout(() => setRing(false), 700)
      }
      prevUnread.current = unread
    } catch {
      setFailed(true)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  useEffect(() => {
    if (!isOpen) return
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setIsOpen(false)
    const onKey = (e) => e.key === 'Escape' && setIsOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen])

  const markRead = async (id) => {
    try {
      await notificationService.markRead(id)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
      prevUnread.current = Math.max(0, (prevUnread.current || 1) - 1)
    } catch {
      /* stays unread; the list refreshes on the next poll */
    }
  }

  const markAll = async () => {
    try {
      await notificationService.markAllRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      prevUnread.current = 0
    } catch {
      /* ignore */
    }
  }

  const base = userRole === 'admin' ? '/admin' : '/faculty'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="btn-icon relative w-10 h-10 border border-line bg-surface"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className={`w-[18px] h-[18px] ${ring ? 'animate-wiggle' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-on-accent text-[10px] font-bold flex items-center justify-center ring-2 ring-canvas tabular">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[min(92vw,380px)] sheet !rounded-panel shadow-pop z-50 animate-pop-in origin-top-right">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="font-heading font-bold text-ink">
              Notifications {unreadCount > 0 && <span className="chip-accent ml-1">{unreadCount} new</span>}
            </p>
            {unreadCount > 0 && (
              <button type="button" onClick={markAll} className="text-sm font-semibold text-accent-ink hover:underline inline-flex items-center gap-1">
                <CheckCheck className="w-4 h-4" /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[360px] overflow-y-auto divide-y divide-line">
            {!loaded ? (
              <li className="px-4 py-6 text-sm text-ink-2 text-center">Loading…</li>
            ) : failed && notifications.length === 0 ? (
              <li className="px-4 py-6 text-sm text-ink-2 text-center">Notifications could not be loaded.</li>
            ) : notifications.length === 0 ? (
              <li className="px-4 py-6 text-sm text-ink-2 text-center">You're all caught up.</li>
            ) : (
              notifications.slice(0, 6).map((n) => {
                const cat = CATEGORIES[categorize(n)]
                const Icon = cat.icon
                const unread = !isRead(n)
                return (
                  <li key={n.id} className={`flex gap-3 px-4 py-3 ${unread ? 'bg-accent-soft/40' : ''}`}>
                    <span className="mt-0.5 w-7 h-7 rounded-full bg-surface-2 border border-line flex items-center justify-center text-ink-2 shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm text-ink ${unread ? 'font-semibold' : ''} line-clamp-2`}>{n.title}</p>
                      <p className="text-xs text-ink-2 mt-0.5">{relativeTime(n.created_at)}</p>
                    </div>
                    {unread && (
                      <button type="button" onClick={() => markRead(n.id)} className="self-start text-xs font-semibold text-accent-ink hover:underline shrink-0">
                        Mark read
                      </button>
                    )}
                  </li>
                )
              })
            )}
          </ul>
          <Link
            to={`${base}/notifications`}
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2.5 text-center text-sm font-semibold text-accent-ink border-t border-line hover:bg-surface-2 rounded-b-panel"
          >
            Open notification centre
          </Link>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { Bell, CheckCheck, Clock, AlertCircle, Info, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { notificationService } from '../services/notificationService'

export default function NotificationBell({ userRole = 'faculty' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef(null)

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const data = await notificationService.getAll()
      const list = Array.isArray(data) ? data : data.notifications || []
      setNotifications(list)
      const unread = list.filter((n) => !n.is_read && !n.read).length
      setUnreadCount(unread)
    } catch {
      // Ignore background poll errors
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleMarkRead = async (id, e) => {
    e.stopPropagation()
    try {
      await notificationService.markRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read: true } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch (err) {
      console.error(err)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead()
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read: true }))
      )
      setUnreadCount(0)
    } catch (err) {
      console.error(err)
    }
  }

  const getIcon = (type) => {
    switch (type) {
      case 'warning':
      case 'alert':
        return <AlertCircle className="w-4 h-4 text-warning" />
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-success" />
      default:
        return <Info className="w-4 h-4 text-info" />
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl border border-border bg-white text-textSecondary hover:text-accent hover:border-primary/50 transition-colors shadow-sm"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-accent text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card rounded-2xl shadow-card-hover border border-border py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <h4 className="font-heading font-semibold text-sm text-textPrimary">
                Notifications
              </h4>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-primary/20 text-accent font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-accent hover:underline flex items-center gap-1 font-medium"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
            {loading && notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-textSecondary">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-textSecondary">
                No notifications right now
              </div>
            ) : (
              notifications.slice(0, 5).map((n) => {
                const isRead = n.is_read || n.read
                return (
                  <div
                    key={n.id}
                    className={`p-3.5 flex items-start gap-3 hover:bg-background/60 transition-colors ${
                      !isRead ? 'bg-secondary/20' : ''
                    }`}
                  >
                    <div className="mt-0.5 p-1 rounded-lg bg-white border border-border">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs text-textPrimary ${!isRead ? 'font-semibold' : ''}`}>
                        {n.title || n.message}
                      </p>
                      {n.title && n.message && (
                        <p className="text-[11px] text-textSecondary mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-textSecondary">
                        <Clock className="w-3 h-3" />
                        <span>{n.created_at || n.time || 'Just now'}</span>
                      </div>
                    </div>
                    {!isRead && (
                      <button
                        onClick={(e) => handleMarkRead(n.id, e)}
                        className="text-[10px] text-accent hover:underline font-medium shrink-0"
                      >
                        Read
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {userRole === 'faculty' && (
            <div className="border-t border-border p-2 text-center bg-background/40">
              <Link
                to="/faculty/notifications"
                onClick={() => setIsOpen(false)}
                className="text-xs font-medium text-accent hover:underline block py-1"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

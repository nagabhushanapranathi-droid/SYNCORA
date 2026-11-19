import { useState, useEffect, useMemo } from 'react'
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  Filter,
  Check,
} from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import { notificationService } from '../../services/notificationService'
import { useToast } from '../../context/ToastContext'

export default function FacultyNotifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [actionLoading, setActionLoading] = useState(false)

  const toast = useToast()

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const res = await notificationService.getAll()
      const list = Array.isArray(res) ? res : res.notifications || []
      setNotifications(list)
    } catch {
      toast.error('Failed to load notifications.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  const handleMarkRead = async (id) => {
    try {
      await notificationService.markRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read: true } : n))
      )
      toast.success('Marked as read.')
    } catch {
      toast.error('Failed to update notification.')
    }
  }

  const handleMarkAllRead = async () => {
    setActionLoading(true)
    try {
      await notificationService.markAllRead()
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read: true }))
      )
      toast.success('All notifications marked as read.')
    } catch {
      toast.error('Failed to mark all as read.')
    } finally {
      setActionLoading(false)
    }
  }

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const isRead = Boolean(n.is_read || n.read)
      if (filter === 'UNREAD') return !isRead
      if (filter === 'READ') return isRead
      return true
    })
  }, [notifications, filter])

  const unreadCount = notifications.filter((n) => !n.is_read && !n.read).length

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'warning':
      case 'alert':
        return <AlertTriangle className="w-5 h-5 text-warning" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-error" />
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-success" />
      default:
        return <Info className="w-5 h-5 text-info" />
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header & Mark All Read */}
      <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-bold text-lg text-textPrimary">
            Notifications & System Alerts
          </h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Real-time substitution dispatch requests, schedule adjustments, and announcements.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={actionLoading}
            className="btn-secondary text-xs shadow-sm self-start sm:self-auto"
          >
            <CheckCheck className="w-4 h-4" />
            Mark All Read ({unreadCount})
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex p-1 bg-white border border-border rounded-xl w-fit shadow-sm">
        {[
          { id: 'ALL', label: `All (${notifications.length})` },
          { id: 'UNREAD', label: `Unread (${unreadCount})` },
          { id: 'READ', label: `Read (${notifications.length - unreadCount})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === tab.id
                ? 'bg-accent text-white shadow-sm'
                : 'text-textSecondary hover:text-textPrimary hover:bg-secondary/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="card !p-0 overflow-hidden divide-y divide-border">
        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner message="Loading notification log..." />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications found"
            description="You are completely caught up with all institutional updates."
          />
        ) : (
          filteredNotifications.map((n) => {
            const isRead = Boolean(n.is_read || n.read)

            return (
              <div
                key={n.id}
                className={`p-4 sm:p-5 flex items-start gap-4 transition-colors ${
                  !isRead ? 'bg-secondary/15' : 'bg-white hover:bg-background/50'
                }`}
              >
                {/* Type Icon */}
                <div className="p-2.5 rounded-xl bg-white border border-border shadow-sm shrink-0 mt-0.5">
                  {getNotificationIcon(n.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={`text-sm text-textPrimary leading-tight ${
                        !isRead ? 'font-bold' : 'font-medium'
                      }`}
                    >
                      {n.title || n.message}
                    </h4>
                    <span className="text-[11px] text-textSecondary font-mono shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {n.created_at || n.time || 'Recently'}
                    </span>
                  </div>

                  {n.title && n.message && (
                    <p className="text-xs text-textSecondary mt-1 leading-relaxed">
                      {n.message}
                    </p>
                  )}
                </div>

                {/* Action button */}
                {!isRead && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="p-1.5 rounded-lg text-accent hover:bg-secondary transition-colors shrink-0"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

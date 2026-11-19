import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCheck, Check, BookOpen } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { SkeletonRows } from '../components/LoadingSpinner'
import { PageHeader, ErrorState, Segmented } from '../components/ui'
import { notificationService } from '../services/notificationService'
import { errorMessage } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import useLoad from '../lib/useLoad'
import { asList, parseTimestamp, relativeTime } from '../lib/format'
import { CATEGORIES, categorize, priorityOf, isRead } from '../lib/notifications'

const TONE_TILE = {
  accent: 'bg-accent-soft text-accent-ink',
  ok: 'bg-ok-soft text-ok-ink',
  danger: 'bg-danger-soft text-danger-ink',
  info: 'bg-info-soft text-info-ink',
  warn: 'bg-warn-soft text-warn-ink',
  neutral: 'bg-surface-2 text-ink-2',
}

function dayBucket(d) {
  if (!d) return 'Earlier'
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const diff = (start - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return 'Earlier this week'
  return 'Earlier'
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const isAdmin = user?.role === 'admin'
  const list = useLoad(() => notificationService.getAll().then((d) => asList(d, 'notifications')), [], { initial: [] })
  const [view, setView] = useState('all')
  const [cat, setCat] = useState('')
  const [busyAll, setBusyAll] = useState(false)

  const items = list.data
  const unread = items.filter((n) => !isRead(n)).length
  const catCounts = useMemo(() => {
    const m = {}
    items.forEach((n) => {
      const k = categorize(n)
      m[k] = (m[k] || 0) + 1
    })
    return m
  }, [items])

  const visible = items.filter((n) => (view === 'unread' ? !isRead(n) : true) && (!cat || categorize(n) === cat))
  const groups = useMemo(() => {
    const g = []
    visible.forEach((n) => {
      const b = dayBucket(parseTimestamp(n.created_at))
      let grp = g.find((x) => x.label === b)
      if (!grp) g.push((grp = { label: b, items: [] }))
      grp.items.push(n)
    })
    return g
  }, [visible])

  const markRead = async (n) => {
    try {
      await notificationService.markRead(n.id)
      list.setData((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
    } catch (err) {
      toast.error(errorMessage(err, 'Could not mark it as read.'))
    }
  }

  const markAll = async () => {
    setBusyAll(true)
    try {
      await notificationService.markAllRead()
      list.setData((prev) => prev.map((x) => ({ ...x, is_read: true })))
      toast.success('All notifications marked as read.')
    } catch (err) {
      toast.error(errorMessage(err, 'Could not mark everything as read.'))
    } finally {
      setBusyAll(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Notifications"
        description={isAdmin ? 'Requests that need you and updates from across SYNCORA.' : 'Messages about your classes, cover duties and lesson plans.'}
        actions={
          unread > 0 && (
            <button type="button" className="btn-secondary" onClick={markAll} disabled={busyAll}>
              <CheckCheck className="w-4 h-4" />
              Mark all as read
            </button>
          )
        }
      />

      <div className="flex flex-col gap-3 mb-5">
        <Segmented
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { id: 'all', label: 'All', count: items.length },
            { id: 'unread', label: 'Unread', count: unread },
          ]}
          className="w-fit"
        />
        {Object.keys(catCounts).length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category">
            <button type="button" onClick={() => setCat('')} aria-pressed={!cat} className={`chip ${!cat ? 'chip-accent' : 'chip-neutral'}`}>
              Every category
            </button>
            {Object.entries(catCounts).map(([k, n]) => {
              const C = CATEGORIES[k]
              return (
                <button key={k} type="button" onClick={() => setCat(cat === k ? '' : k)} aria-pressed={cat === k} className={`chip ${cat === k ? 'chip-accent' : 'chip-neutral'}`}>
                  <C.icon className="w-3 h-3" />
                  {C.label} {n}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {list.loading ? (
        <div className="sheet p-5">
          <SkeletonRows rows={5} />
        </div>
      ) : list.error ? (
        <div className="sheet">
          <ErrorState message={list.error} onRetry={list.reload} />
        </div>
      ) : visible.length === 0 ? (
        <div className="sheet">
          <EmptyState
            mascot
            title={view === 'unread' ? "You're all caught up" : 'No notifications yet'}
            description={
              view === 'unread'
                ? 'Nothing unread. New messages about cover and lesson plans appear here.'
                : isAdmin
                ? 'Notifications arrive when substitution requests need attention.'
                : 'You will hear from SYNCORA when you are asked to cover a class or a lesson plan is ready.'
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="text-sm font-semibold text-ink-2 mb-2">{g.label}</h2>
              <ul className="sheet divide-y divide-line overflow-hidden">
                {g.items.map((n) => (
                  <NotificationItem key={n.id} n={n} isAdmin={isAdmin} onRead={() => markRead(n)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function NotificationItem({ n, isAdmin, onRead }) {
  const [expanded, setExpanded] = useState(false)
  const catKey = categorize(n)
  const C = CATEGORIES[catKey]
  const prio = priorityOf(n)
  const unread = !isRead(n)
  const long = (n.message || '').length > 240
  const when = parseTimestamp(n.created_at)
  const base = isAdmin ? '/admin' : '/faculty'

  return (
    <li className={`relative flex gap-3.5 px-4 sm:px-5 py-4 ${unread ? 'bg-accent-soft/30' : ''}`}>
      {unread && <span className="absolute left-1.5 top-6 w-1.5 h-1.5 rounded-full bg-accent" aria-label="Unread" />}
      <span className={`w-9 h-9 rounded-panel flex items-center justify-center shrink-0 ${TONE_TILE[C.tone]}`} aria-hidden="true">
        <C.icon className="w-4 h-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className={`text-base text-ink ${unread ? 'font-bold' : 'font-semibold'}`}>{n.title}</h3>
          {prio === 'high' && <span className="chip-danger">Short notice</span>}
          {prio === 'medium' && <span className="chip-warn">Needs attention</span>}
        </div>
        <p className="text-xs text-ink-3 mt-0.5">
          {C.label}, <time dateTime={when?.toISOString()} title={when?.toLocaleString()}>{relativeTime(n.created_at)}</time>
        </p>
        <p className={`mt-2 text-sm text-ink-2 whitespace-pre-line leading-relaxed ${long && !expanded ? 'line-clamp-3' : ''}`}>{n.message}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {long && (
            <button type="button" className="text-xs font-semibold text-accent-ink hover:underline" onClick={() => setExpanded((e) => !e)}>
              {expanded ? 'Show less' : 'Read full message'}
            </button>
          )}
          {n.related_request_id && ['lesson', 'assignment', 'approval', 'handover'].includes(catKey) && (
            <Link to={`${base}/lesson-plan/${n.related_request_id}`} className="btn-secondary btn-sm">
              <BookOpen className="w-3.5 h-3.5" />
              Open lesson plan
            </Link>
          )}
          {n.related_request_id && (
            <Link to={isAdmin ? `/admin/substitutions?id=${n.related_request_id}` : '/faculty/substitutions'} className="btn-ghost btn-sm">
              {isAdmin ? 'View request' : 'Cover duties'}
            </Link>
          )}
          {unread && (
            <button type="button" className="btn-ghost btn-sm ml-auto" onClick={onRead}>
              <Check className="w-3.5 h-3.5" />
              Mark as read
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

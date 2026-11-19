import {
  ArrowLeftRight,
  CheckCircle2,
  XCircle,
  BookOpen,
  CalendarClock,
  Ban,
  FileText,
  CalendarCheck,
  Megaphone,
  Clock,
  Bell,
} from 'lucide-react'

/**
 * Notification records carry { title, message, type, is_read, related_request_id }.
 * The backend (communication_service / notification_service) uses stable title
 * prefixes, so the category is read from the stored title — content is never rewritten.
 */
export const CATEGORIES = {
  assignment: { label: 'Cover assignments', icon: ArrowLeftRight, tone: 'accent' },
  approval: { label: 'Approvals', icon: CheckCircle2, tone: 'ok' },
  rejection: { label: 'Changes & rejections', icon: XCircle, tone: 'danger' },
  lesson: { label: 'Lesson plans', icon: BookOpen, tone: 'info' },
  timetable: { label: 'Timetable changes', icon: CalendarClock, tone: 'warn' },
  cancellation: { label: 'Cancellations', icon: Ban, tone: 'danger' },
  handover: { label: 'Handover requests', icon: FileText, tone: 'info' },
  attendance: { label: 'Attendance', icon: CalendarCheck, tone: 'ok' },
  announcement: { label: 'Announcements', icon: Megaphone, tone: 'accent' },
  reminder: { label: 'Reminders', icon: Clock, tone: 'warn' },
  other: { label: 'General', icon: Bell, tone: 'neutral' },
}

const RULES = [
  [/^class coverage invitation|^new substitution assignment|^substitution request pending/i, 'assignment'],
  [/^substitution approved/i, 'approval'],
  [/^substitution schedule update|reject/i, 'rejection'],
  [/lesson plan/i, 'lesson'],
  [/^timetable adjustment|timetable/i, 'timetable'],
  [/cancel|suspend/i, 'cancellation'],
  [/handover/i, 'handover'],
  [/attendance|check-in/i, 'attendance'],
  [/^notice:|announcement/i, 'announcement'],
  [/reminder/i, 'reminder'],
]

export function categorize(n) {
  const title = n?.title || ''
  for (const [re, cat] of RULES) if (re.test(title)) return cat
  return 'other'
}

/** Priority from stored type + urgency markers in the title ("[Short Notice]"). */
export function priorityOf(n) {
  const title = n?.title || ''
  const type = (n?.type || '').toLowerCase()
  if (/short notice|urgent/i.test(title) || type === 'error') return 'high'
  if (type === 'warning' || /^timetable adjustment/i.test(title)) return 'medium'
  return 'normal'
}

export function isRead(n) {
  return Boolean(n?.is_read || n?.read)
}

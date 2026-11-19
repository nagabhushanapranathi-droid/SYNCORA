// Small, dependency-free helpers shared by every page.

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ALL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Coerce an API payload into an array (tolerates { key: [...] } shapes). */
export function asList(value, key) {
  if (Array.isArray(value)) return value
  if (value && key && Array.isArray(value[key])) return value[key]
  return []
}

/** Local calendar date as YYYY-MM-DD (avoids the UTC shift of toISOString). */
export function isoDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse 'YYYY-MM-DD' as a local date. */
export function parseISODate(s) {
  if (!s) return null
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function weekdayName(d = new Date()) {
  return ALL_DAYS[d.getDay()]
}

export function weekdayOf(isoStr) {
  const d = parseISODate(isoStr)
  return d ? ALL_DAYS[d.getDay()] : null
}

/** Monday–Saturday date strings of the week containing `d`. */
export function weekDates(d = new Date()) {
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const offset = (base.getDay() + 6) % 7 // Monday = 0
  base.setDate(base.getDate() - offset)
  return WEEKDAYS.map((name, i) => {
    const x = new Date(base)
    x.setDate(base.getDate() + i)
    return { name, iso: isoDate(x), date: x }
  })
}

export function formatDate(value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '—'
  const d = typeof value === 'string' && value.length <= 10 ? parseISODate(value) : new Date(value)
  if (!d || Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString(undefined, opts)
}

export function formatDateLong(value) {
  return formatDate(value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Backend timestamps are naive UTC (datetime.utcnow().isoformat()). Treat a string
 * without an offset as UTC so local display is correct.
 */
export function parseTimestamp(value) {
  if (!value) return null
  const s = String(value)
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s)
  const d = new Date(hasZone || s.length <= 10 ? s : `${s}Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function relativeTime(value) {
  const d = parseTimestamp(value)
  if (!d) return ''
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 45) return 'just now'
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)} d ago`
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function formatClock(value) {
  const d = parseTimestamp(value)
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
}

/** 'HH:MM' or 'HH:MM:SS' → 'HH:MM'. */
export function hhmm(t) {
  if (!t) return ''
  return String(t).slice(0, 5)
}

export function minutesOf(t) {
  if (!t) return null
  const [h, m] = String(t).split(':').map(Number)
  if (Number.isNaN(h)) return null
  return h * 60 + (m || 0)
}

export function timeRange(start, end) {
  if (!start && !end) return '—'
  return `${hhmm(start)}–${hhmm(end)}`
}

export function initials(name = '') {
  return (
    String(name)
      .replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  )
}

export function firstName(name = '') {
  const cleaned = String(name).replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, '')
  return cleaned.split(/\s+/)[0] || name
}

export function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function pluralize(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

export function pct(part, whole) {
  if (!whole) return null
  return Math.round((part / whole) * 100)
}

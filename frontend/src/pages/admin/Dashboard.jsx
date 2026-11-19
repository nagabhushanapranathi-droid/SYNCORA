import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  UserX,
  ArrowLeftRight,
  Check,
  X,
  AlertTriangle,
  Info,
  CircleSlash,
  Clock,
  CalendarDays,
  Activity,
  ShieldCheck,
} from 'lucide-react'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import ConfirmDialog from '../../components/ConfirmDialog'
import { Skeleton, SkeletonRows } from '../../components/LoadingSpinner'
import { PageHeader, SheetHeader, ErrorState } from '../../components/ui'
import { reportService } from '../../services/reportService'
import { attendanceService } from '../../services/attendanceService'
import { substitutionService } from '../../services/substitutionService'
import { absenceService } from '../../services/absenceService'
import { timetableService } from '../../services/timetableService'
import { errorMessage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import useLoad from '../../lib/useLoad'
import { useChartTheme, ChartTooltip, ChartLegend } from '../../lib/chartTheme'
import { asList, isoDate, weekdayName, greeting, formatDate, hhmm, relativeTime, parseTimestamp, pluralize } from '../../lib/format'

export default function Dashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const today = isoDate()
  const todayName = weekdayName()

  const stats = useLoad(() => reportService.getStats(), [])
  const attendance = useLoad(() => attendanceService.getToday(), [])
  const subs = useLoad(() => substitutionService.getAll().then((d) => asList(d)), [], { initial: [] })
  const absences = useLoad(() => absenceService.getAll().then((d) => asList(d)), [], { initial: [] })
  const classes = useLoad(() => timetableService.getAll({ day: todayName }).then((d) => asList(d)), [todayName], { initial: [] })

  const [busyId, setBusyId] = useState(null)
  const [rejecting, setRejecting] = useState(null)

  const queue = useMemo(
    () =>
      subs.data
        .filter((s) => ['RECOMMENDED', 'PENDING'].includes((s.status || '').toUpperCase()))
        .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.start_time || '').localeCompare(b.start_time || '')),
    [subs.data]
  )
  const covered = subs.data.filter((s) => ['APPROVED', 'ASSIGNED'].includes(s.status) && (s.date || '') >= today)
  const awaitingAck = covered.filter((s) => s.assignment && !s.assignment.is_acknowledged)
  const todaysSubs = subs.data.filter((s) => s.date === today)
  const subByTimetable = useMemo(() => Object.fromEntries(todaysSubs.map((s) => [s.timetable_id, s])), [todaysSubs])

  const refreshAll = () => {
    stats.reload()
    subs.reload()
    attendance.reload()
  }

  const approve = async (s) => {
    setBusyId(s.id)
    try {
      await substitutionService.approve(s.id)
      toast.success(`Approved ${s.recommended_faculty_name || 'the recommended substitute'} for ${s.subject_name}.`)
      refreshAll()
    } catch (err) {
      toast.error(errorMessage(err, 'Approval failed.'))
    } finally {
      setBusyId(null)
    }
  }

  const reject = async () => {
    if (!rejecting) return
    setBusyId(rejecting.id)
    try {
      await substitutionService.reject(rejecting.id)
      toast.info(`Rejected the recommendation for ${rejecting.subject_name}.`)
      setRejecting(null)
      refreshAll()
    } catch (err) {
      toast.error(errorMessage(err, 'Rejection failed.'))
    } finally {
      setBusyId(null)
    }
  }

  // Operational alerts derived from live records only.
  const alerts = []
  const noCandidate = queue.filter((s) => s.status === 'PENDING')
  if (noCandidate.length)
    alerts.push({
      tone: 'danger',
      icon: CircleSlash,
      text: `${pluralize(noCandidate.length, 'class', 'classes')} with no eligible substitute`,
      to: '/admin/substitutions?status=PENDING',
    })
  if (awaitingAck.length)
    alerts.push({
      tone: 'warn',
      icon: Clock,
      text: `${pluralize(awaitingAck.length, 'approved cover duty', 'approved cover duties')} not yet acknowledged`,
      to: '/admin/substitutions?status=APPROVED',
    })
  if (attendance.data?.not_marked_count > 0)
    alerts.push({
      tone: 'info',
      icon: Info,
      text: `${pluralize(attendance.data.not_marked_count, 'faculty member has', 'faculty members have')} not checked in today`,
      to: '/admin/attendance',
    })

  return (
    <div className="space-y-6">
      <PageHeader
        title={user?.name ? `${greeting()}, ${user.name}` : greeting()}
        description="Here is how today's teaching is covered across the institution."
        actions={
          <>
            <Link to="/admin/substitutions" className="btn-secondary">
              <ArrowLeftRight className="w-4 h-4" />
              Open queue
            </Link>
            <Link to="/admin/absences" className="btn-primary">
              <UserX className="w-4 h-4" />
              Report an absence
            </Link>
          </>
        }
      />

      <Ledger stats={stats} attendance={attendance} queueCount={queue.length} coveredCount={covered.length} subsLoading={subs.loading} />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Decision queue */}
        <section className="sheet lg:col-span-7" aria-labelledby="queue-h">
          <SheetHeader
            title={<span id="queue-h">Needs your decision</span>}
            description="Ranked by the allocation rules. You make the call."
            actions={
              <Link to="/admin/substitutions" className="text-sm font-semibold text-accent-ink hover:underline">
                Full queue
              </Link>
            }
          />
          <div className="px-5 pb-5">
            {subs.loading ? (
              <SkeletonRows rows={3} />
            ) : subs.error ? (
              <ErrorState compact message={subs.error} onRetry={subs.reload} />
            ) : queue.length === 0 ? (
              <EmptyState compact icon={ShieldCheck} title="Nothing waiting" description="Every reported absence has a decision. New requests appear here when an absence is filed." />
            ) : (
              <ul className="space-y-2.5">
                {queue.slice(0, 5).map((s) => (
                  <li key={s.id} className="panel p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-14 shrink-0 text-center rounded-md bg-surface border border-line py-1.5">
                        <p className="text-2xs text-ink-2">{formatDate(s.date, { day: 'numeric', month: 'short' })}</p>
                        <p className="font-heading font-bold text-sm text-ink tabular">{hhmm(s.start_time)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink truncate">
                          {s.subject_name}<span className="font-normal text-ink-2">, {s.class_name}{s.section ? ` (${s.section})` : ''}</span>
                        </p>
                        <p className="text-sm text-ink-2">
                          For {s.absent_faculty_name}
                          {s.recommended_faculty_name ? (
                            <>
                              {' '}→ <span className="font-semibold text-ink">{s.recommended_faculty_name}</span>
                              {typeof s.recommendation_score === 'number' && <span className="text-ink-3"> ({Math.round(s.recommendation_score)}/100 fit)</span>}
                            </>
                          ) : (
                            <span className="text-danger-ink font-medium"> — no eligible substitute</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:shrink-0">
                      {s.recommended_faculty_id ? (
                        <>
                          <button type="button" onClick={() => setRejecting(s)} disabled={busyId === s.id} className="btn-ghost btn-sm" aria-label={`Reject recommendation for ${s.subject_name}`}>
                            <X className="w-4 h-4" />
                            Reject
                          </button>
                          <button type="button" onClick={() => approve(s)} disabled={busyId === s.id} className="btn-primary btn-sm">
                            <Check className="w-4 h-4" />
                            Approve
                          </button>
                        </>
                      ) : (
                        <Link to={`/admin/substitutions?id=${s.id}`} className="btn-secondary btn-sm">
                          Assign manually
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
                {queue.length > 5 && (
                  <li className="text-sm text-ink-2 pt-1">
                    {queue.length - 5} more in the{' '}
                    <Link to="/admin/substitutions" className="font-semibold text-accent-ink hover:underline">
                      substitution queue
                    </Link>
                    .
                  </li>
                )}
              </ul>
            )}
          </div>
        </section>

        {/* Attendance donut + alerts */}
        <div className="lg:col-span-5 space-y-6">
          <AttendanceToday attendance={attendance} />
          <section className="sheet" aria-labelledby="alerts-h">
            <SheetHeader title={<span id="alerts-h">Operational alerts</span>} icon={AlertTriangle} />
            <div className="px-5 pb-5">
              {subs.loading || attendance.loading ? (
                <Skeleton className="h-10" />
              ) : alerts.length === 0 ? (
                <p className="text-sm text-ink-2">No open issues right now.</p>
              ) : (
                <ul className="space-y-2">
                  {alerts.map((a) => (
                    <li key={a.text}>
                      <Link
                        to={a.to}
                        className={`flex items-center gap-3 rounded-panel px-3 py-2.5 text-sm font-medium text-ink transition-colors ${
                          { danger: 'bg-danger-soft hover:bg-danger-soft/70', warn: 'bg-warn-soft hover:bg-warn-soft/70', info: 'bg-info-soft hover:bg-info-soft/70' }[a.tone]
                        }`}
                      >
                        <a.icon className={`w-4 h-4 shrink-0 ${{ danger: 'text-danger-ink', warn: 'text-warn-ink', info: 'text-info-ink' }[a.tone]}`} />
                        {a.text}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>

      <TodayTimetable classes={classes} subByTimetable={subByTimetable} todayName={todayName} />

      <div className="grid gap-6 lg:grid-cols-12">
        <WeekTrend stats={stats} />
        <RecentActivity subs={subs} absences={absences} />
      </div>

      <ConfirmDialog
        isOpen={!!rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={reject}
        loading={busyId === rejecting?.id}
        isDestructive
        title="Reject this recommendation?"
        confirmText="Reject recommendation"
        message={
          rejecting
            ? `${rejecting.recommended_faculty_name} will not cover ${rejecting.subject_name} (${rejecting.class_name}) on ${formatDate(rejecting.date)}. They are notified, and the class stays uncovered until you assign someone.`
            : ''
        }
      />
    </div>
  )
}

function Ledger({ stats, attendance, queueCount, coveredCount, subsLoading }) {
  const a = attendance.data
  const s = stats.data
  const items = [
    { label: 'Faculty on roll', value: s?.total_faculty ?? a?.total_faculty, note: 'Active staff', loading: stats.loading && attendance.loading },
    {
      label: 'Present today',
      value: a?.present_count,
      note: a ? (a.not_marked_count ? `${a.not_marked_count} not yet marked` : 'Everyone checked in') : '',
      loading: attendance.loading,
    },
    { label: 'Absent today', value: a?.absent_count, note: a?.logged_out_count ? `${a.logged_out_count} logged out` : 'Reported absences', loading: attendance.loading },
    { label: 'Awaiting decision', value: queueCount, note: 'Recommended or unmatched', loading: subsLoading },
    { label: 'Cover arranged', value: coveredCount, note: 'Approved, today onward', loading: subsLoading },
  ]
  const failed = stats.error && attendance.error
  return (
    <section className="sheet-feature px-2 py-5" aria-label="Today at a glance">
      {failed ? (
        <ErrorState compact message={attendance.error} onRetry={() => { stats.reload(); attendance.reload() }} />
      ) : (
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-5">
          {items.map((it, i) => (
            <div key={it.label} className={`px-4 sm:px-5 ${i > 0 ? 'lg:rule-v' : ''}`}>
              <dt className="text-sm text-ink-2">{it.label}</dt>
              <dd className="mt-1">
                {it.loading ? (
                  <Skeleton className="h-9 w-14" />
                ) : (
                  <span className="font-heading font-black text-[2.1rem] leading-none text-ink tabular">{it.value ?? '—'}</span>
                )}
              </dd>
              <dd className="mt-1.5 text-xs text-ink-3">{it.note}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

function AttendanceToday({ attendance }) {
  const c = useChartTheme()
  const a = attendance.data
  const parts = a
    ? [
        { name: 'Present', value: a.present_count || 0, color: c.good },
        { name: 'Absent', value: a.absent_count || 0, color: c.critical },
        { name: 'Logged out', value: a.logged_out_count || 0, color: c.warning },
        { name: 'Not marked', value: a.not_marked_count || 0, color: c.neutral },
      ]
    : []
  const total = parts.reduce((t, p) => t + p.value, 0)
  return (
    <section className="sheet" aria-labelledby="att-h">
      <SheetHeader
        title={<span id="att-h">Attendance today</span>}
        actions={
          <Link to="/admin/attendance" className="text-sm font-semibold text-accent-ink hover:underline">
            Attendance log
          </Link>
        }
      />
      <div className="px-5 pb-5">
        {attendance.loading ? (
          <Skeleton className="h-40" />
        ) : attendance.error ? (
          <ErrorState compact message={attendance.error} onRetry={attendance.reload} />
        ) : total === 0 ? (
          <EmptyState compact icon={CalendarDays} title="No faculty on roll" />
        ) : (
          <div className="flex items-center gap-5">
            <div className="relative w-[140px] h-[140px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={parts.filter((p) => p.value > 0)} dataKey="value" nameKey="name" innerRadius={46} outerRadius={66} paddingAngle={2} stroke={c.surface} strokeWidth={2} startAngle={90} endAngle={-270}>
                    {parts.filter((p) => p.value > 0).map((p) => (
                      <Cell key={p.name} fill={p.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-heading font-black text-xl text-ink tabular">
                  {a.present_count}/{total}
                </span>
                <span className="text-2xs text-ink-2">present</span>
              </div>
            </div>
            <ul className="flex-1 space-y-2 text-sm">
              {parts.map((p) => (
                <li key={p.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color }} aria-hidden="true" />
                  <span className="text-ink-2">{p.name}</span>
                  <span className="ml-auto font-semibold text-ink tabular">{p.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

function TodayTimetable({ classes, subByTimetable, todayName }) {
  const byTime = useMemo(() => {
    const groups = {}
    classes.data.forEach((c) => {
      const k = `${hhmm(c.start_time)}–${hhmm(c.end_time)}`
      ;(groups[k] = groups[k] || []).push(c)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [classes.data])
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()

  return (
    <section className="sheet" aria-labelledby="tt-h">
      <SheetHeader
        title={<span id="tt-h">{todayName}'s timetable</span>}
        description={classes.loading ? 'Loading…' : `${pluralize(classes.data.length, 'class', 'classes')} scheduled today`}
        icon={CalendarDays}
        actions={
          <Link to="/admin/timetable" className="text-sm font-semibold text-accent-ink hover:underline">
            Weekly timetable
          </Link>
        }
      />
      <div className="px-5 pb-5">
        {classes.loading ? (
          <Skeleton className="h-28" />
        ) : classes.error ? (
          <ErrorState compact message={classes.error} onRetry={classes.reload} />
        ) : byTime.length === 0 ? (
          <EmptyState compact icon={CalendarDays} title={`No classes on ${todayName}`} description="The weekly timetable has nothing scheduled for today." />
        ) : (
          <ol className="relative space-y-3">
            {byTime.map(([slot, list]) => {
              const [s, e] = slot.split('–')
              const sm = Number(s.slice(0, 2)) * 60 + Number(s.slice(3))
              const em = Number(e.slice(0, 2)) * 60 + Number(e.slice(3))
              const live = nowMin >= sm && nowMin < em
              const past = nowMin >= em
              return (
                <li key={slot} className="grid grid-cols-[76px_1fr] gap-3 items-start">
                  <div className={`pt-2 text-sm font-semibold tabular ${live ? 'text-accent-ink' : past ? 'text-ink-3' : 'text-ink'}`}>
                    {s}
                    {live && <span className="block text-2xs font-semibold text-accent-ink">Now</span>}
                  </div>
                  <div className={`min-w-0 flex flex-wrap gap-2 ${live ? 'rounded-panel bg-accent-soft/50 p-1.5 -m-1.5' : ''}`}>
                    {list.map((c) => {
                      const sub = subByTimetable[c.id]
                      const status = sub?.status
                      const cover = status && ['APPROVED', 'ASSIGNED'].includes(status)
                      const needs = status && ['PENDING', 'RECOMMENDED'].includes(status)
                      return (
                        <div
                          key={c.id}
                          className={`w-full sm:w-auto sm:min-w-[170px] sm:max-w-[260px] sm:flex-1 min-w-0 rounded-panel border px-3 py-2 ${
                            needs ? 'border-warn bg-warn-soft' : cover ? 'border-ok/80 bg-ok-soft' : status === 'SUSPENDED' ? 'border-line bg-surface-2 opacity-70' : 'border-line bg-surface'
                          }`}
                        >
                          <p className={`text-sm font-semibold text-ink truncate ${status === 'SUSPENDED' ? 'line-through' : ''}`}>{c.subject_name}</p>
                          <p className="text-xs text-ink-2 truncate">
                            {c.class_name}
                            {c.section ? ` (${c.section})` : ''}
                            {c.classroom ? `, ${c.classroom}` : ''}
                          </p>
                          <p className="text-xs text-ink-2 truncate mt-0.5">
                            {cover ? (
                              <>
                                Covered by <span className="font-semibold text-ok-ink">{sub.assignment?.assigned_faculty_name || sub.recommended_faculty_name}</span>
                              </>
                            ) : needs ? (
                              <span className="font-semibold text-warn-ink">Needs cover — {c.faculty_name} absent</span>
                            ) : status === 'SUSPENDED' ? (
                              'Suspended'
                            ) : (
                              c.faculty_name
                            )}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}

function WeekTrend({ stats }) {
  const c = useChartTheme()
  const data = stats.data?.weekly_trends || []
  const hasAny = data.some((d) => d.absences || d.substitutions)
  return (
    <section className="sheet lg:col-span-7" aria-labelledby="trend-h">
      <SheetHeader
        title={<span id="trend-h">Disruptions this week</span>}
        description="Absences reported and substitution requests created, last 7 days"
        icon={Activity}
      />
      <div className="px-5 pb-5">
        {stats.loading ? (
          <Skeleton className="h-52" />
        ) : stats.error ? (
          <ErrorState compact message={stats.error} onRetry={stats.reload} />
        ) : !hasAny ? (
          <EmptyState compact icon={Activity} title="A quiet week" description="No absences or substitution requests in the last 7 days." />
        ) : (
          <>
            <ChartLegend
              items={[
                { label: 'Absences', color: c.series[0], line: true },
                { label: 'Substitution requests', color: c.series[1], line: true },
              ]}
            />
            <div className="h-52 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid {...c.gridProps} />
                  <XAxis dataKey="day_name" {...c.axisProps} />
                  <YAxis allowDecimals={false} {...c.axisProps} width={40} />
                  <Tooltip content={<ChartTooltip labelFormatter={(l, p) => formatDate(p?.[0]?.payload?.date, { weekday: 'long', day: 'numeric', month: 'short' })} />} cursor={{ stroke: c.grid }} />
                  <Line type="linear" dataKey="absences" name="Absences" stroke={c.series[0]} strokeWidth={2} dot={{ r: 4, fill: c.series[0], stroke: c.surface, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="linear" dataKey="substitutions" name="Substitution requests" stroke={c.series[1]} strokeWidth={2} dot={{ r: 4, fill: c.series[1], stroke: c.surface, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function RecentActivity({ subs, absences }) {
  const events = useMemo(() => {
    const ev = []
    absences.data.forEach((a) =>
      ev.push({ key: `a${a.id}`, at: a.created_at, icon: UserX, text: <>Absence reported for <b className="font-semibold">{a.faculty_name}</b> on {formatDate(a.date, { day: 'numeric', month: 'short' })}</> })
    )
    subs.data.forEach((s) => {
      if (['APPROVED', 'ASSIGNED', 'REJECTED', 'SUSPENDED'].includes(s.status)) {
        const who = s.assignment?.assigned_faculty_name || s.recommended_faculty_name
        const verb = { APPROVED: 'approved', ASSIGNED: 'assigned', REJECTED: 'rejected', SUSPENDED: 'suspended' }[s.status]
        ev.push({
          key: `s${s.id}`,
          at: s.assignment?.assigned_at || s.updated_at,
          icon: ArrowLeftRight,
          status: s.status,
          text: (
            <>
              {s.subject_name} ({s.class_name}) {verb}
              {who && ['APPROVED', 'ASSIGNED'].includes(s.status) ? (
                <>
                  {' '}— <b className="font-semibold">{who}</b> covering
                </>
              ) : null}
            </>
          ),
        })
      }
    })
    return ev
      .filter((e) => parseTimestamp(e.at))
      .sort((x, y) => parseTimestamp(y.at) - parseTimestamp(x.at))
      .slice(0, 7)
  }, [subs.data, absences.data])

  return (
    <section className="sheet lg:col-span-5" aria-labelledby="act-h">
      <SheetHeader title={<span id="act-h">Recent activity</span>} />
      <div className="px-5 pb-5">
        {subs.loading || absences.loading ? (
          <SkeletonRows rows={4} />
        ) : events.length === 0 ? (
          <EmptyState compact icon={Activity} title="No recent activity" />
        ) : (
          <ol className="relative">
            {events.map((e, i) => (
              <li key={e.key} className="relative flex gap-3 pb-4 last:pb-0">
                {i < events.length - 1 && <span className="absolute left-[15px] top-8 bottom-0 rule-v" aria-hidden="true" />}
                <span className="w-8 h-8 rounded-full bg-surface-2 border border-line flex items-center justify-center text-ink-2 shrink-0">
                  <e.icon className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0 pt-1">
                  <p className="text-sm text-ink">{e.text}</p>
                  <p className="text-xs text-ink-3 mt-0.5 flex items-center gap-2">
                    {relativeTime(e.at)}
                    {e.status && <Badge status={e.status} />}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}


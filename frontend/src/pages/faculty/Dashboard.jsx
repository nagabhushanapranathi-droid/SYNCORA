import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ArrowLeftRight, Check, BookOpen, Bell, MapPin, Clock, FileText, UserRound } from 'lucide-react'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Mascot from '../../components/Mascot'
import { Skeleton, SkeletonRows } from '../../components/LoadingSpinner'
import { PageHeader, SheetHeader, ErrorState } from '../../components/ui'
import { timetableService } from '../../services/timetableService'
import { substitutionService } from '../../services/substitutionService'
import { notificationService } from '../../services/notificationService'
import { attendanceService } from '../../services/attendanceService'
import { facultyService } from '../../services/facultyService'
import { errorMessage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import useLoad from '../../lib/useLoad'
import { splitDuties } from '../../lib/facultyData'
import { isRead, CATEGORIES, categorize } from '../../lib/notifications'
import { asList, isoDate, weekdayName, greeting, firstName, formatDate, hhmm, minutesOf, relativeTime, pluralize } from '../../lib/format'

export default function FacultyDashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const fid = user?.faculty_id
  const today = isoDate()
  const day = weekdayName()

  const profile = useLoad(() => (fid ? facultyService.getById(fid) : Promise.resolve(null)), [fid])
  const classes = useLoad(() => (fid ? timetableService.getAll({ faculty_id: fid, day }).then((d) => asList(d)) : Promise.resolve([])), [fid, day], { initial: [] })
  const subs = useLoad(() => (fid ? substitutionService.getAll({ faculty_id: fid }).then((d) => asList(d)) : Promise.resolve([])), [fid], { initial: [] })
  const attendance = useLoad(() => (fid ? attendanceService.getAll({ faculty_id: fid, date: today }).then((d) => asList(d)[0] || null) : Promise.resolve(null)), [fid, today])
  const notes = useLoad(() => notificationService.getAll().then((d) => asList(d, 'notifications')), [], { initial: [] })

  const [ackId, setAckId] = useState(null)
  const [plans, setPlans] = useState({})

  const duties = useMemo(() => splitDuties(subs.data, fid), [subs.data, fid])

  // Lesson plan availability for upcoming duties (one lookup each; small lists).
  useEffect(() => {
    const ids = duties.upcoming.slice(0, 6).map((s) => s.id)
    if (!ids.length) return
    let alive = true
    Promise.allSettled(ids.map((id) => substitutionService.getLessonPlan(id))).then((res) => {
      if (!alive) return
      const m = {}
      res.forEach((r, i) => (m[ids[i]] = r.status === 'fulfilled' ? r.value : null))
      setPlans(m)
    })
    return () => {
      alive = false
    }
  }, [duties.upcoming])

  const acknowledge = async (s) => {
    setAckId(s.id)
    try {
      await substitutionService.acknowledge(s.id)
      toast.success(`Thanks — ${s.subject_name} on ${formatDate(s.date, { day: 'numeric', month: 'short' })} is acknowledged.`)
      subs.reload()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not acknowledge this duty.'))
    } finally {
      setAckId(null)
    }
  }

  if (!fid) {
    return (
      <div className="sheet">
        <EmptyState mascot title="No faculty profile linked" description="This account is not connected to a faculty record, so there is no personal schedule to show. Administrators can use the admin office." action={<Link to="/admin/dashboard" className="btn-primary btn-sm">Go to admin office</Link>} />
      </div>
    )
  }

  // Today's agenda: own classes plus cover duties today.
  const agenda = [
    ...classes.data.map((c) => ({ kind: 'class', id: `c${c.id}`, start: c.start_time, end: c.end_time, title: c.subject_name, sub: `${c.class_name}${c.section ? ` (${c.section})` : ''}`, room: c.classroom, covered: duties.coveredForMe.find((s) => s.timetable_id === c.id && s.date === today) })),
    ...duties.upcoming.filter((s) => s.date === today).map((s) => ({ kind: 'cover', id: `s${s.id}`, start: s.start_time, end: s.end_time, title: s.subject_name, sub: `${s.class_name}${s.section ? ` (${s.section})` : ''}, for ${s.absent_faculty_name}`, room: s.classroom, sub_req: s })),
  ].sort((a, b) => (a.start || '').localeCompare(b.start || ''))

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const next = agenda.find((a) => minutesOf(a.end) > nowMin && !(a.kind === 'class' && a.covered))
  const unread = notes.data.filter((n) => !isRead(n))
  const att = attendance.data
  const dept = profile.data?.department_name

  return (
    <div className="space-y-6">
      <PageHeader title={`${greeting()}, ${firstName(user?.name)}`} description={`${dept ? `${dept}. ` : ''}Here is your ${day === 'Sunday' ? 'Sunday' : 'day'} at a glance.`} />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Next up */}
        <section className="sheet-feature lg:col-span-7 p-5 sm:p-6 pt-7" aria-label="Next up">
          {classes.loading || subs.loading ? (
            <Skeleton className="h-28" />
          ) : next ? (
            <div className="flex items-start gap-4">
              <div className="w-20 shrink-0 text-center rounded-panel bg-surface-2 border border-line py-2.5">
                <p className="font-heading font-black text-2xl text-ink tabular leading-none">{hhmm(next.start)}</p>
                <p className="text-xs text-ink-2 mt-1">to {hhmm(next.end)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-accent-ink">
                  {minutesOf(next.start) <= nowMin ? 'Happening now' : `Next up, in ${humanMinutes(minutesOf(next.start) - nowMin)}`}
                  {next.kind === 'cover' && ' — cover duty'}
                </p>
                <h2 className="font-heading font-extrabold text-2xl text-ink mt-0.5">{next.title}</h2>
                <p className="text-base text-ink-2">{next.sub}</p>
                {next.room && (
                  <p className="text-sm text-ink-2 mt-1 inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {next.room}
                  </p>
                )}
                {next.kind === 'cover' && (
                  <div className="mt-3">
                    <Link to={`/faculty/lesson-plan/${next.sub_req.id}`} className="btn-primary btn-sm">
                      <BookOpen className="w-4 h-4" />
                      Open lesson plan
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Mascot size={64} mood="happy" />
              <div>
                <h2 className="font-heading font-extrabold text-xl text-ink">{agenda.length ? 'All done for today' : 'No classes today'}</h2>
                <p className="text-sm text-ink-2">{agenda.length ? 'Your remaining classes are finished.' : `Nothing is timetabled for you on ${day}.`}</p>
              </div>
            </div>
          )}
        </section>

        {/* Glance */}
        <section className="sheet lg:col-span-5 p-5" aria-label="Your status">
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-ink-2">Attendance today</dt>
              <dd className="mt-1.5">
                {attendance.loading ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <span className="flex flex-col items-start gap-1">
                    <Badge status={att?.status || 'NOT_MARKED'} />
                    {att?.login_time && <span className="text-xs text-ink-2">Checked in at {hhmm(att.login_time)}</span>}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-2">Classes today</dt>
              <dd className="font-heading font-black text-2xl text-ink tabular mt-0.5">{classes.loading ? '…' : classes.data.length}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-2">Upcoming cover duties</dt>
              <dd className="font-heading font-black text-2xl text-ink tabular mt-0.5">{subs.loading ? '…' : duties.upcoming.length}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-2">Waiting for your OK</dt>
              <dd className={`font-heading font-black text-2xl tabular mt-0.5 ${duties.awaitingAck.length ? 'text-accent-ink' : 'text-ink'}`}>{subs.loading ? '…' : duties.awaitingAck.length}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Today's agenda */}
        <section className="sheet lg:col-span-7" aria-labelledby="agenda-h">
          <SheetHeader
            title={<span id="agenda-h">{day}'s schedule</span>}
            icon={CalendarDays}
            actions={
              <Link to="/faculty/timetable" className="text-sm font-semibold text-accent-ink hover:underline">
                Full week
              </Link>
            }
          />
          <div className="px-5 pb-5">
            {classes.loading || subs.loading ? (
              <SkeletonRows rows={3} />
            ) : classes.error ? (
              <ErrorState compact message={classes.error} onRetry={classes.reload} />
            ) : agenda.length === 0 ? (
              <EmptyState compact icon={CalendarDays} title="A free day" description={`You have no classes or cover duties on ${day}.`} />
            ) : (
              <ol className="relative">
                {agenda.map((a, i) => {
                  const done = minutesOf(a.end) <= nowMin
                  const live = minutesOf(a.start) <= nowMin && !done
                  return (
                    <li key={a.id} className="relative flex gap-4 pb-4 last:pb-0">
                      {i < agenda.length - 1 && <span className="absolute left-[39px] top-9 bottom-0 rule-v" aria-hidden="true" />}
                      <span className={`w-[80px] shrink-0 text-sm tabular pt-1.5 ${done ? 'text-ink-3' : 'font-semibold text-ink'}`}>
                        {hhmm(a.start)}
                        <span className="block text-xs font-normal text-ink-3">{hhmm(a.end)}</span>
                      </span>
                      <div className={`flex-1 min-w-0 rounded-panel border px-3.5 py-2.5 ${a.kind === 'cover' ? 'border-accent/40 bg-accent-soft/50' : a.covered ? 'border-line bg-surface-2' : live ? 'border-accent bg-surface' : 'border-line bg-surface'} ${done ? 'opacity-60' : ''}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink">{a.title}</p>
                          {a.kind === 'cover' && <span className="chip-accent">Cover duty</span>}
                          {live && <span className="chip-ok">Now</span>}
                          {a.covered && <Badge status={a.covered.status} label={['APPROVED', 'ASSIGNED'].includes(a.covered.status) ? `Covered by ${a.covered.assignment?.assigned_faculty_name || a.covered.recommended_faculty_name}` : undefined} />}
                        </div>
                        <p className="text-sm text-ink-2">
                          {a.sub}
                          {a.room ? `, ${a.room}` : ''}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </section>

        {/* Cover duties */}
        <section className="sheet lg:col-span-5" aria-labelledby="duties-h">
          <SheetHeader
            title={<span id="duties-h">Your cover duties</span>}
            icon={ArrowLeftRight}
            actions={
              <Link to="/faculty/substitutions" className="text-sm font-semibold text-accent-ink hover:underline">
                All duties
              </Link>
            }
          />
          <div className="px-5 pb-5">
            {subs.loading ? (
              <SkeletonRows rows={2} />
            ) : subs.error ? (
              <ErrorState compact message={subs.error} onRetry={subs.reload} />
            ) : duties.upcoming.length === 0 ? (
              <EmptyState compact icon={ArrowLeftRight} title="No cover duties ahead" description={duties.proposed.length ? `You are proposed for ${pluralize(duties.proposed.length, 'class', 'classes')}, awaiting approval.` : 'When you are asked to cover a class it appears here.'} />
            ) : (
              <ul className="space-y-2.5">
                {duties.upcoming.slice(0, 4).map((s) => {
                  const plan = plans[s.id]
                  return (
                    <li key={s.id} className="panel p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink truncate">{s.subject_name}</p>
                          <p className="text-sm text-ink-2">
                            {formatDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' })}, {hhmm(s.start_time)}–{hhmm(s.end_time)}
                          </p>
                          <p className="text-xs text-ink-2 mt-0.5">
                            {s.class_name}
                            {s.classroom ? `, ${s.classroom}` : ''}, for {s.absent_faculty_name}
                          </p>
                        </div>
                        {s.assignment?.is_acknowledged ? <Badge status="ACKNOWLEDGED" /> : <Badge status="AWAITING_ACK" label="Needs your OK" />}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {!s.assignment?.is_acknowledged && (
                          <button type="button" className="btn-primary btn-sm" onClick={() => acknowledge(s)} disabled={ackId === s.id}>
                            <Check className="w-4 h-4" />
                            {ackId === s.id ? 'Saving…' : 'Acknowledge'}
                          </button>
                        )}
                        <Link to={`/faculty/lesson-plan/${s.id}`} className="btn-secondary btn-sm">
                          <BookOpen className="w-4 h-4" />
                          {plan ? 'Lesson plan' : plan === null ? 'Prepare plan' : 'Lesson plan'}
                        </Link>
                        <span className="text-xs text-ink-2">{plan === undefined ? '' : plan ? 'Plan ready' : 'No plan yet'}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="sheet lg:col-span-7" aria-labelledby="mine-h">
          <SheetHeader title={<span id="mine-h">Your classes covered by colleagues</span>} description="Leave a handover note so they continue from the right place." icon={UserRound} />
          <div className="px-5 pb-5">
            {subs.loading ? (
              <SkeletonRows rows={2} />
            ) : duties.coveredForMe.filter((s) => s.date >= today).length === 0 ? (
              <p className="text-sm text-ink-2">None of your upcoming classes need cover.</p>
            ) : (
              <ul className="divide-y divide-line">
                {duties.coveredForMe
                  .filter((s) => s.date >= today)
                  .slice(0, 5)
                  .map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">{s.subject_name}</p>
                        <p className="text-sm text-ink-2">
                          {formatDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' })}, {hhmm(s.start_time)}, {s.class_name}
                        </p>
                      </div>
                      <Badge status={s.status} label={['APPROVED', 'ASSIGNED'].includes(s.status) ? `Covered by ${s.assignment?.assigned_faculty_name || s.recommended_faculty_name}` : undefined} />
                      {['APPROVED', 'ASSIGNED'].includes(s.status) && (
                        <Link to={`/faculty/lesson-plan/${s.id}`} className="btn-ghost btn-sm">
                          <FileText className="w-4 h-4" />
                          Handover
                        </Link>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </section>

        <section className="sheet lg:col-span-5" aria-labelledby="notes-h">
          <SheetHeader
            title={<span id="notes-h">Latest notifications</span>}
            icon={Bell}
            actions={
              <Link to="/faculty/notifications" className="text-sm font-semibold text-accent-ink hover:underline">
                {unread.length ? `${unread.length} unread` : 'All'}
              </Link>
            }
          />
          <div className="px-5 pb-5">
            {notes.loading ? (
              <SkeletonRows rows={3} />
            ) : notes.error ? (
              <ErrorState compact message={notes.error} onRetry={notes.reload} />
            ) : notes.data.length === 0 ? (
              <p className="text-sm text-ink-2">No notifications yet.</p>
            ) : (
              <ul className="space-y-3">
                {notes.data.slice(0, 4).map((n) => {
                  const C = CATEGORIES[categorize(n)]
                  return (
                    <li key={n.id} className="flex gap-3">
                      <span className="w-8 h-8 rounded-full bg-surface-2 border border-line flex items-center justify-center text-ink-2 shrink-0">
                        <C.icon className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className={`text-sm text-ink line-clamp-2 ${isRead(n) ? '' : 'font-semibold'}`}>{n.title}</p>
                        <p className="text-xs text-ink-3 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {relativeTime(n.created_at)}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function humanMinutes(m) {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, MapPin, BookOpen } from 'lucide-react'
import Modal from '../../components/Modal'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import { Skeleton } from '../../components/LoadingSpinner'
import { PageHeader, ErrorState, Meta } from '../../components/ui'
import { timetableService } from '../../services/timetableService'
import { substitutionService } from '../../services/substitutionService'
import { useAuth } from '../../context/AuthContext'
import useLoad from '../../lib/useLoad'
import useMediaQuery from '../../lib/useMediaQuery'
import { splitDuties } from '../../lib/facultyData'
import { asList, weekDates, weekdayName, hhmm, formatDate, formatDateLong, WEEKDAYS } from '../../lib/format'

export default function FacultyTimetable() {
  const { user } = useAuth()
  const fid = user?.faculty_id
  const wide = useMediaQuery('(min-width: 900px)')
  const today = weekdayName()
  const week = weekDates()
  const [day, setDay] = useState(WEEKDAYS.includes(today) ? today : 'Monday')
  const [open, setOpen] = useState(null)

  const entries = useLoad(() => (fid ? timetableService.getAll({ faculty_id: fid }).then((d) => asList(d)) : Promise.resolve([])), [fid], { initial: [] })
  const subs = useLoad(() => (fid ? substitutionService.getAll({ faculty_id: fid }).then((d) => asList(d)) : Promise.resolve([])), [fid], { initial: [] })

  const duties = useMemo(() => splitDuties(subs.data, fid), [subs.data, fid])
  const isoByDay = Object.fromEntries(week.map((w) => [w.name, w.iso]))

  // Items for one weekday this week: own classes (with cover status) + cover duties.
  const itemsFor = (d) => {
    const iso = isoByDay[d]
    const own = entries.data
      .filter((e) => e.day_of_week === d)
      .map((e) => ({ kind: 'class', key: `c${e.id}`, e, start: e.start_time, end: e.end_time, cover: duties.coveredForMe.find((s) => s.timetable_id === e.id && s.date === iso) }))
    const cover = [...duties.upcoming, ...duties.past].filter((s) => s.date === iso).map((s) => ({ kind: 'cover', key: `s${s.id}`, s, start: s.start_time, end: s.end_time }))
    return [...own, ...cover].sort((a, b) => (a.start || '').localeCompare(b.start || ''))
  }

  const slots = useMemo(() => {
    const m = new Map()
    entries.data.forEach((e) => m.set(`${hhmm(e.start_time)}-${hhmm(e.end_time)}`, [hhmm(e.start_time), hhmm(e.end_time)]))
    ;[...duties.upcoming, ...duties.past].forEach((s) => {
      if (Object.values(isoByDay).includes(s.date)) m.set(`${hhmm(s.start_time)}-${hhmm(s.end_time)}`, [hhmm(s.start_time), hhmm(s.end_time)])
    })
    return [...m.values()].sort((a, b) => a[0].localeCompare(b[0]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.data, duties])

  const laterDuties = duties.upcoming.filter((s) => s.date > week[week.length - 1].iso)
  const loading = entries.loading || subs.loading

  if (!fid) {
    return (
      <div className="sheet">
        <EmptyState mascot title="No faculty profile linked" description="This account has no personal timetable." />
      </div>
    )
  }

  const Card = ({ it }) =>
    it.kind === 'cover' ? (
      <button type="button" onClick={() => setOpen(it)} className="w-full text-left rounded-md border-2 border-dashed border-accent/60 bg-accent-soft px-2.5 py-2">
        <span className="block text-sm font-semibold text-ink">{it.s.subject_name}</span>
        <span className="block text-xs text-ink-2 truncate">
          Cover for {it.s.absent_faculty_name}, {it.s.class_name}
        </span>
        <span className="block text-xs text-ink-2 truncate">{it.s.classroom}</span>
      </button>
    ) : (
      <button type="button" onClick={() => setOpen(it)} className={`w-full text-left rounded-md border border-line px-2.5 py-2 ${it.cover ? 'bg-surface-2' : 'bg-surface hover:shadow-sheet'}`}>
        <span className={`block text-sm font-semibold text-ink ${it.cover?.status === 'SUSPENDED' ? 'line-through' : ''}`}>{it.e.subject_name}</span>
        <span className="block text-xs text-ink-2 truncate">
          {it.e.class_name}
          {it.e.section ? ` (${it.e.section})` : ''}
          {it.e.classroom ? `, ${it.e.classroom}` : ''}
        </span>
        {it.cover && <span className="mt-1 inline-flex chip-neutral !text-2xs">{['APPROVED', 'ASSIGNED'].includes(it.cover.status) ? `Covered by ${it.cover.assignment?.assigned_faculty_name || it.cover.recommended_faculty_name}` : 'You are away'}</span>}
      </button>
    )

  return (
    <div className="space-y-5">
      <PageHeader title="My timetable" description="Your weekly classes, with this week's cover duties and the classes colleagues are covering for you." />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border border-line bg-surface" aria-hidden="true" />
          Your class
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-2 border-dashed border-accent/60 bg-accent-soft" aria-hidden="true" />
          Cover duty
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border border-line bg-surface-2" aria-hidden="true" />
          Covered by a colleague
        </span>
      </div>

      {!wide && (
        <div className="seg w-full overflow-x-auto flex-nowrap relative" role="tablist" aria-label="Day">
          {week.map((w) => (
            <button key={w.name} type="button" role="tab" aria-selected={day === w.name} onClick={() => setDay(w.name)} className="seg-item shrink-0">
              {w.name.slice(0, 3)} <span className="text-2xs text-ink-3 tabular">{w.date.getDate()}</span>
              {w.name === today && <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-label="today" />}
            </button>
          ))}
        </div>
      )}

      <section className="sheet overflow-hidden" aria-label="Weekly timetable">
        {loading ? (
          <div className="p-5">
            <Skeleton className="h-64" />
          </div>
        ) : entries.error ? (
          <ErrorState message={entries.error} onRetry={entries.reload} />
        ) : slots.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No classes timetabled" description="Your administrator has not scheduled any classes for you yet." />
        ) : wide ? (
          <div className="overflow-x-auto relative">
            <table className="w-full border-collapse min-w-[860px] table-fixed">
              <thead>
                <tr>
                  <th className="w-[80px] bg-surface-2 border-b border-line" />
                  {week.map((w) => (
                    <th key={w.name} className={`px-2 py-2.5 text-left border-b border-l border-line ${w.name === today ? 'bg-accent-soft' : 'bg-surface-2'}`}>
                      <span className={`block text-sm font-semibold ${w.name === today ? 'text-accent-ink' : 'text-ink'}`}>{w.name}</span>
                      <span className="block text-xs font-normal text-ink-2">
                        {formatDate(w.iso, { day: 'numeric', month: 'short' })}
                        {w.name === today ? ', today' : ''}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot.join()}>
                    <th scope="row" className="align-top px-3 py-3 text-left border-b border-line bg-surface-2/60">
                      <span className="block text-sm font-semibold text-ink tabular">{slot[0]}</span>
                      <span className="block text-xs text-ink-3 tabular">{slot[1]}</span>
                    </th>
                    {WEEKDAYS.map((d) => {
                      const list = itemsFor(d).filter((it) => hhmm(it.start) === slot[0] && hhmm(it.end) === slot[1])
                      return (
                        <td key={d} className={`align-top p-1.5 border-b border-l border-line ${d === today ? 'bg-accent-soft/25' : ''}`}>
                          <div className="space-y-1.5">
                            {list.map((it) => (
                              <Card key={it.key} it={it} />
                            ))}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4">
            {itemsFor(day).length === 0 ? (
              <EmptyState compact icon={CalendarDays} title={`Free on ${day}`} />
            ) : (
              <ul className="space-y-3">
                {itemsFor(day).map((it) => (
                  <li key={it.key} className="grid grid-cols-[60px_1fr] gap-3">
                    <span className="pt-2 text-sm font-semibold text-ink tabular">
                      {hhmm(it.start)}
                      <span className="block text-xs font-normal text-ink-3">{hhmm(it.end)}</span>
                    </span>
                    <Card it={it} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {laterDuties.length > 0 && (
        <section className="sheet p-5" aria-labelledby="later-h">
          <h2 id="later-h" className="sheet-title mb-3">
            Cover duties after this week
          </h2>
          <ul className="divide-y divide-line">
            {laterDuties.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="w-28 text-sm font-semibold text-ink">{formatDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span className="flex-1 min-w-0 text-sm text-ink truncate">
                  {hhmm(s.start_time)} {s.subject_name}, {s.class_name}
                </span>
                <Link to={`/faculty/lesson-plan/${s.id}`} className="btn-ghost btn-sm">
                  Lesson plan
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal isOpen={!!open} onClose={() => setOpen(null)} title={open?.kind === 'cover' ? open.s.subject_name : open?.e?.subject_name || ''} subtitle={open ? `${hhmm(open.start)}–${hhmm(open.end)}` : ''}>
        {open?.kind === 'cover' ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Meta label="Date">{formatDateLong(open.s.date)}</Meta>
              <Meta label="Covering for">{open.s.absent_faculty_name}</Meta>
              <Meta label="Class">
                {open.s.class_name}
                {open.s.section ? `, section ${open.s.section}` : ''}
              </Meta>
              <Meta label="Room">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-ink-3" />
                  {open.s.classroom || 'Not set'}
                </span>
              </Meta>
            </dl>
            <div className="flex flex-wrap items-center gap-2">
              <Badge status={open.s.assignment?.is_acknowledged ? 'ACKNOWLEDGED' : 'AWAITING_ACK'} />
              <Link to={`/faculty/lesson-plan/${open.s.id}`} className="btn-primary btn-sm ml-auto">
                <BookOpen className="w-4 h-4" />
                Open lesson plan
              </Link>
            </div>
          </div>
        ) : open ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Meta label="Subject code">{open.e.subject_code}</Meta>
              <Meta label="Department">{open.e.department_name}</Meta>
              <Meta label="Class">
                {open.e.class_name}
                {open.e.section ? `, section ${open.e.section}` : ''}
              </Meta>
              <Meta label="Room">{open.e.classroom || 'Not set'}</Meta>
            </dl>
            {open.cover && (
              <div className="panel p-3 text-sm flex flex-wrap items-center gap-2">
                <span className="text-ink-2">On {formatDate(open.cover.date)} you are away:</span>
                <Badge status={open.cover.status} />
                {['APPROVED', 'ASSIGNED'].includes(open.cover.status) && (
                  <Link to={`/faculty/lesson-plan/${open.cover.id}`} className="ml-auto font-semibold text-accent-ink hover:underline">
                    Write a handover note
                  </Link>
                )}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}


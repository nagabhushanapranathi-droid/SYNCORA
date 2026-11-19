import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, AlertTriangle, CalendarDays, MapPin, ArrowLeftRight } from 'lucide-react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import { Skeleton } from '../../components/LoadingSpinner'
import { PageHeader, ErrorState, Segmented, Field, Meta } from '../../components/ui'
import { timetableService } from '../../services/timetableService'
import { facultyService } from '../../services/facultyService'
import { departmentService } from '../../services/departmentService'
import { subjectService } from '../../services/subjectService'
import { substitutionService } from '../../services/substitutionService'
import { errorMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import useLoad from '../../lib/useLoad'
import useMediaQuery from '../../lib/useMediaQuery'
import { asList, WEEKDAYS, weekDates, weekdayName, hhmm, minutesOf, formatDate } from '../../lib/format'

// Department tints give each department a stable identity in the grid.
const DEPT_TONES = [
  'bg-accent-soft border-l-accent',
  'bg-ok-soft border-l-ok',
  'bg-info-soft border-l-info',
  'bg-warn-soft border-l-warn',
]
const DEPT_SWATCH = ['bg-accent', 'bg-ok', 'bg-info', 'bg-warn']

/** Overlapping entries for the same faculty or room on the same day. */
export function findClashes(entries) {
  const clash = {}
  const byDay = {}
  entries.forEach((e) => (byDay[e.day_of_week] = byDay[e.day_of_week] || []).push(e))
  Object.values(byDay).forEach((list) => {
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j]
        const overlap = minutesOf(a.start_time) < minutesOf(b.end_time) && minutesOf(a.end_time) > minutesOf(b.start_time)
        if (!overlap) continue
        if (a.faculty_id === b.faculty_id) {
          ;(clash[a.id] = clash[a.id] || []).push(`${a.faculty_name} is also teaching ${b.subject_name} (${b.class_name})`)
          ;(clash[b.id] = clash[b.id] || []).push(`${b.faculty_name} is also teaching ${a.subject_name} (${a.class_name})`)
        }
        if (a.classroom && a.classroom === b.classroom) {
          ;(clash[a.id] = clash[a.id] || []).push(`${a.classroom} is also booked for ${b.subject_name}`)
          ;(clash[b.id] = clash[b.id] || []).push(`${b.classroom} is also booked for ${a.subject_name}`)
        }
      }
  })
  return clash
}

export default function Timetable() {
  const toast = useToast()
  const isWide = useMediaQuery('(min-width: 900px)')
  const today = weekdayName()
  const week = weekDates()

  const entries = useLoad(() => timetableService.getAll().then((d) => asList(d)), [], { initial: [] })
  const faculty = useLoad(() => facultyService.getAll().then((d) => asList(d)), [], { initial: [] })
  const departments = useLoad(() => departmentService.getAll().then((d) => asList(d)), [], { initial: [] })
  const subjects = useLoad(() => subjectService.getAll().then((d) => asList(d)), [], { initial: [] })
  const subs = useLoad(() => substitutionService.getAll().then((d) => asList(d)), [], { initial: [] })

  const [dept, setDept] = useState('')
  const [fac, setFac] = useState('')
  const [cls, setCls] = useState('')
  const [view, setView] = useState('week')
  const [day, setDay] = useState(WEEKDAYS.includes(today) ? today : 'Monday')
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null) // {entry?} or {day,start,end}
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const deptIndex = useMemo(() => Object.fromEntries(departments.data.map((d, i) => [d.id, i % DEPT_TONES.length])), [departments.data])
  const classes = useMemo(() => [...new Set(entries.data.map((e) => e.class_name))].sort(), [entries.data])

  const filtered = entries.data.filter(
    (e) => (!dept || String(e.department_id) === dept) && (!fac || String(e.faculty_id) === fac) && (!cls || e.class_name === cls)
  )
  const clashes = useMemo(() => findClashes(entries.data), [entries.data])
  const clashCount = Object.keys(clashes).length

  const slots = useMemo(() => {
    const set = new Map()
    filtered.forEach((e) => set.set(`${hhmm(e.start_time)}-${hhmm(e.end_time)}`, [hhmm(e.start_time), hhmm(e.end_time)]))
    return [...set.values()].sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))
  }, [filtered])

  // This week's cover status per timetable entry.
  const weekCover = useMemo(() => {
    const isoByDay = Object.fromEntries(week.map((w) => [w.name, w.iso]))
    const map = {}
    subs.data.forEach((s) => {
      if (s.day_of_week && isoByDay[s.day_of_week] === s.date) map[s.timetable_id] = s
    })
    return map
  }, [subs.data, week])

  const cell = (d, slot) => filtered.filter((e) => e.day_of_week === d && hhmm(e.start_time) === slot[0] && hhmm(e.end_time) === slot[1])

  const remove = async () => {
    setBusy(true)
    try {
      await timetableService.delete(deleting.id)
      toast.success(`${deleting.subject_name} removed from ${deleting.day_of_week}s.`)
      setDeleting(null)
      setViewing(null)
      entries.reload()
    } catch (err) {
      toast.error(errorMessage(err, 'The class could not be removed.'))
    } finally {
      setBusy(false)
    }
  }

  const loading = entries.loading || departments.loading
  const showWeek = view === 'week' && isWide

  const Chip = ({ e }) => {
    const tone = DEPT_TONES[deptIndex[e.department_id] ?? 0]
    const cover = weekCover[e.id]
    const coverStatus = cover?.status
    return (
      <button
        type="button"
        onClick={() => setViewing(e)}
        className={`w-full text-left rounded-md border border-line border-l-[3px] ${tone} px-2.5 py-2 hover:shadow-sheet transition-shadow`}
      >
        <span className="flex items-start justify-between gap-1">
          <span className={`text-sm font-semibold text-ink leading-snug ${coverStatus === 'SUSPENDED' ? 'line-through' : ''}`}>{e.subject_name}</span>
          {clashes[e.id] && <AlertTriangle className="w-3.5 h-3.5 text-danger-ink shrink-0 mt-0.5" aria-label="Clash" />}
        </span>
        <span className="block text-xs text-ink-2 truncate">
          {e.class_name}
          {e.section ? ` (${e.section})` : ''}
          {e.classroom ? `, ${e.classroom}` : ''}
        </span>
        <span className="block text-xs text-ink-2 truncate">{e.faculty_name}</span>
        {cover && (
          <span className="mt-1 inline-flex">
            {['APPROVED', 'ASSIGNED'].includes(coverStatus) ? (
              <span className="chip-ok !text-2xs">Cover: {cover.assignment?.assigned_faculty_name || cover.recommended_faculty_name}</span>
            ) : ['PENDING', 'RECOMMENDED'].includes(coverStatus) ? (
              <span className="chip-warn !text-2xs">Needs cover this week</span>
            ) : (
              <Badge status={coverStatus} className="!text-2xs" />
            )}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Timetable"
        description="The weekly teaching template. Cover arranged for this week shows on each class."
        actions={
          <button type="button" className="btn-primary" onClick={() => setEditing({ day, start: '09:00', end: '10:00' })}>
            <Plus className="w-4 h-4" />
            Add a class
          </button>
        }
      />

      <div className="sheet p-4 flex flex-col xl:flex-row xl:items-end gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          <Field label="Department" htmlFor="tt-dept">
            <select id="tt-dept" className="input" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments</option>
              {departments.data.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Faculty" htmlFor="tt-fac">
            <select id="tt-fac" className="input" value={fac} onChange={(e) => setFac(e.target.value)}>
              <option value="">All faculty</option>
              {faculty.data.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Class" htmlFor="tt-cls">
            <select id="tt-cls" className="input" value={cls} onChange={(e) => setCls(e.target.value)}>
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {isWide && (
          <Segmented
            label="Layout"
            value={view}
            onChange={setView}
            options={[
              { id: 'week', label: 'Week' },
              { id: 'day', label: 'Day' },
            ]}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
        {departments.data.map((d) => (
          <span key={d.id} className="inline-flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${DEPT_SWATCH[deptIndex[d.id]]}`} aria-hidden="true" />
            {d.name}
          </span>
        ))}
        {clashCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-danger-ink font-semibold">
            <AlertTriangle className="w-4 h-4" />
            {clashCount} classes clash
          </span>
        )}
      </div>

      {!showWeek && (
        <div className="seg w-full overflow-x-auto flex-nowrap relative" role="tablist" aria-label="Day">
          {week.map((w) => (
            <button key={w.name} type="button" role="tab" aria-selected={day === w.name} onClick={() => setDay(w.name)} className="seg-item shrink-0">
              {w.name.slice(0, 3)}
              <span className="text-2xs text-ink-3 tabular">{w.date.getDate()}</span>
              {w.name === today && <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-label="today" />}
            </button>
          ))}
        </div>
      )}

      <section className="sheet overflow-hidden" aria-label="Weekly timetable">
        {loading ? (
          <div className="p-5">
            <Skeleton className="h-72" />
          </div>
        ) : entries.error ? (
          <ErrorState message={entries.error} onRetry={entries.reload} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={entries.data.length ? 'No classes match these filters' : 'The timetable is empty'}
            description={entries.data.length ? 'Clear a filter to see more classes.' : 'Add the first class to start the weekly template.'}
            actionLabel={entries.data.length ? '' : 'Add a class'}
            onAction={() => setEditing({ day, start: '09:00', end: '10:00' })}
          />
        ) : showWeek ? (
          <div className="overflow-x-auto relative">
            <table className="w-full border-collapse min-w-[980px] table-fixed">
              <thead>
                <tr>
                  <th className="w-[84px] bg-surface-2 border-b border-line" />
                  {week.map((w) => (
                    <th key={w.name} className={`px-2 py-2.5 text-left border-b border-l border-line ${w.name === today ? 'bg-accent-soft' : 'bg-surface-2'}`}>
                      <span className={`block text-sm font-semibold ${w.name === today ? 'text-accent-ink' : 'text-ink'}`}>{w.name}</span>
                      <span className="block text-xs text-ink-2 font-normal">
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
                      const list = cell(d, slot)
                      return (
                        <td key={d} className={`align-top p-1.5 border-b border-l border-line ${d === today ? 'bg-accent-soft/25' : ''}`}>
                          <div className="space-y-1.5">
                            {list.map((e) => (
                              <Chip key={e.id} e={e} />
                            ))}
                            <button
                              type="button"
                              onClick={() => setEditing({ day: d, start: slot[0], end: slot[1] })}
                              className="w-full h-7 rounded-md border border-dashed border-line text-ink-3 hover:text-accent-ink hover:border-accent/50 flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
                              aria-label={`Add a class on ${d} at ${slot[0]}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
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
          <div className="p-4 space-y-4">
            {slots.filter((slot) => cell(day, slot).length).length === 0 ? (
              <EmptyState compact icon={CalendarDays} title={`Nothing on ${day}`} description="No classes match on this day." />
            ) : (
              slots.map((slot) => {
                const list = cell(day, slot)
                if (!list.length) return null
                return (
                  <div key={slot.join()} className="grid grid-cols-[64px_1fr] gap-3">
                    <div className="pt-2">
                      <p className="text-sm font-semibold text-ink tabular">{slot[0]}</p>
                      <p className="text-xs text-ink-3 tabular">{slot[1]}</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {list.map((e) => (
                        <Chip key={e.id} e={e} />
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </section>

      {/* Class detail */}
      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.subject_name || ''}
        subtitle={viewing ? `${viewing.day_of_week}s, ${hhmm(viewing.start_time)}–${hhmm(viewing.end_time)}` : ''}
        footer={
          viewing && (
            <>
              <button type="button" onClick={() => setDeleting(viewing)} className="btn-danger-ghost mr-auto">
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setEditing({ entry: viewing })
                  setViewing(null)
                }}
              >
                <Pencil className="w-4 h-4" />
                Edit class
              </button>
            </>
          )
        }
      >
        {viewing && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Meta label="Subject code">{viewing.subject_code}</Meta>
              <Meta label="Department">{viewing.department_name}</Meta>
              <Meta label="Faculty">{viewing.faculty_name}</Meta>
              <Meta label="Class">
                {viewing.class_name}
                {viewing.section ? `, section ${viewing.section}` : ''}
              </Meta>
              <Meta label="Room">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-ink-3" />
                  {viewing.classroom || 'Not set'}
                </span>
              </Meta>
            </dl>
            {clashes[viewing.id] && (
              <div className="rounded-panel bg-danger-soft border border-danger/30 p-3 text-sm text-ink">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-danger-ink" />
                  Timetable clash
                </p>
                <ul className="mt-1 list-disc pl-5 text-ink-2">
                  {clashes[viewing.id].map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {weekCover[viewing.id] && (
              <div className="panel p-3 text-sm flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-ink-3" />
                <span className="text-ink-2">This week ({formatDate(weekCover[viewing.id].date, { day: 'numeric', month: 'short' })}):</span>
                <Badge status={weekCover[viewing.id].status} />
                <Link to={`/admin/substitutions?id=${weekCover[viewing.id].id}`} className="ml-auto font-semibold text-accent-ink hover:underline">
                  View request
                </Link>
              </div>
            )}
          </div>
        )}
      </Modal>

      <EntryForm
        state={editing}
        onClose={() => setEditing(null)}
        faculty={faculty.data}
        departments={departments.data}
        subjects={subjects.data}
        onSaved={(msg) => {
          toast.success(msg)
          setEditing(null)
          entries.reload()
        }}
      />

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        isDestructive
        title="Remove this class from the timetable?"
        confirmText="Remove class"
        message={deleting ? `${deleting.subject_name} (${deleting.class_name}) on ${deleting.day_of_week}s at ${hhmm(deleting.start_time)} will no longer be scheduled. Past substitution records are kept.` : ''}
      />
    </div>
  )
}

function EntryForm({ state, onClose, faculty, departments, subjects, onSaved }) {
  const empty = { faculty_id: '', subject_id: '', department_id: '', class_name: '', section: '', classroom: '', day_of_week: 'Monday', start_time: '09:00', end_time: '10:00' }
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const entry = state?.entry

  useEffect(() => {
    if (!state) return
    setError('')
    if (state.entry) {
      const e = state.entry
      setForm({
        faculty_id: String(e.faculty_id),
        subject_id: String(e.subject_id),
        department_id: String(e.department_id),
        class_name: e.class_name || '',
        section: e.section || '',
        classroom: e.classroom || '',
        day_of_week: e.day_of_week,
        start_time: hhmm(e.start_time),
        end_time: hhmm(e.end_time),
      })
    } else {
      setForm({ ...empty, day_of_week: state.day || 'Monday', start_time: state.start || '09:00', end_time: state.end || '10:00' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  if (!state) return null

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const onSubject = (id) => {
    const s = subjects.find((x) => String(x.id) === id)
    setForm((f) => ({ ...f, subject_id: id, department_id: s ? String(s.department_id) : f.department_id }))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.subject_id || !form.faculty_id || !form.department_id || !form.class_name.trim()) return setError('Subject, faculty, department and class are required.')
    if (form.end_time <= form.start_time) return setError('The class must end after it starts.')
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      faculty_id: Number(form.faculty_id),
      subject_id: Number(form.subject_id),
      department_id: Number(form.department_id),
      class_name: form.class_name.trim(),
      section: form.section.trim(),
      classroom: form.classroom.trim(),
    }
    try {
      if (entry) await timetableService.update(entry.id, payload)
      else await timetableService.create(payload)
      onSaved(entry ? 'Class updated.' : 'Class added to the timetable.')
    } catch (err) {
      setError(errorMessage(err, 'The class could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  const qualified = faculty.filter((f) => f.is_active !== false)

  return (
    <Modal
      isOpen={!!state}
      onClose={onClose}
      closeDisabled={saving}
      title={entry ? 'Edit class' : 'Add a class'}
      subtitle="SYNCORA rejects clashes for the same faculty member or room."
      maxWidth="max-w-xl"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="tt-form" className="btn-primary" disabled={saving}>
            {saving ? 'Checking for clashes…' : entry ? 'Save class' : 'Add class'}
          </button>
        </>
      }
    >
      <form id="tt-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="flex gap-2 rounded-panel bg-danger-soft border border-danger/30 p-3 text-sm text-ink" role="alert">
            <AlertTriangle className="w-4 h-4 text-danger-ink shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject" htmlFor="f-subj">
            <select id="f-subj" className="input" value={form.subject_id} onChange={(e) => onSubject(e.target.value)}>
              <option value="">Choose a subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Faculty" htmlFor="f-fac">
            <select id="f-fac" className="input" value={form.faculty_id} onChange={(e) => set('faculty_id', e.target.value)}>
              <option value="">Choose a faculty member</option>
              {qualified.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {form.subject_id && f.subjects?.some((s) => String(s.id) === form.subject_id) ? ' (qualified)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Department" htmlFor="f-dept">
            <select id="f-dept" className="input" value={form.department_id} onChange={(e) => set('department_id', e.target.value)}>
              <option value="">Choose a department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Day" htmlFor="f-day">
            <select id="f-day" className="input" value={form.day_of_week} onChange={(e) => set('day_of_week', e.target.value)}>
              {WEEKDAYS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Starts" htmlFor="f-start">
            <input id="f-start" type="time" className="input" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
          </Field>
          <Field label="Ends" htmlFor="f-end">
            <input id="f-end" type="time" className="input" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Class" htmlFor="f-cls">
            <input id="f-cls" className="input" value={form.class_name} onChange={(e) => set('class_name', e.target.value)} placeholder="CS-A" />
          </Field>
          <Field label="Section" htmlFor="f-sec">
            <input id="f-sec" className="input" value={form.section} onChange={(e) => set('section', e.target.value)} placeholder="A" maxLength={10} />
          </Field>
          <Field label="Room" htmlFor="f-room">
            <input id="f-room" className="input" value={form.classroom} onChange={(e) => set('classroom', e.target.value)} placeholder="Room-101" />
          </Field>
        </div>
      </form>
    </Modal>
  )
}

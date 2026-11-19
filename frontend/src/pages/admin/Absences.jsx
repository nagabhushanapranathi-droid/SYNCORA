import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserX, CalendarDays, CheckCircle2, ArrowLeftRight, History, AlertTriangle } from 'lucide-react'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import ConfirmDialog from '../../components/ConfirmDialog'
import { SkeletonRows, Skeleton } from '../../components/LoadingSpinner'
import { PageHeader, SheetHeader, ErrorState, Field, SearchInput, Avatar } from '../../components/ui'
import { absenceService } from '../../services/absenceService'
import { facultyService } from '../../services/facultyService'
import { timetableService } from '../../services/timetableService'
import { errorMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import useLoad from '../../lib/useLoad'
import { asList, isoDate, weekdayOf, formatDate, formatDateLong, hhmm, relativeTime, pluralize } from '../../lib/format'

const REASONS = ['Medical leave', 'Personal leave', 'Conference or workshop', 'Official duty', 'Family emergency']

export default function Absences() {
  const toast = useToast()
  const faculty = useLoad(() => facultyService.getAll().then((d) => asList(d).filter((f) => f.is_active !== false)), [], { initial: [] })
  const history = useLoad(() => absenceService.getAll().then((d) => asList(d)), [], { initial: [] })

  const [form, setForm] = useState({ faculty_id: '', date: isoDate(), reason: '', remarks: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [confirmDup, setConfirmDup] = useState(false)
  const [search, setSearch] = useState('')

  const weekday = weekdayOf(form.date)
  const affected = useLoad(
    () =>
      form.faculty_id && weekday && weekday !== 'Sunday'
        ? timetableService.getAll({ faculty_id: form.faculty_id, day: weekday }).then((d) => asList(d))
        : Promise.resolve([]),
    [form.faculty_id, weekday],
    { initial: [] }
  )

  const selectedFaculty = faculty.data.find((f) => String(f.id) === String(form.faculty_id))
  const duplicate = history.data.find((a) => String(a.faculty_id) === String(form.faculty_id) && a.date === form.date)

  const validate = () => {
    const e = {}
    if (!form.faculty_id) e.faculty_id = 'Choose the faculty member who is absent.'
    if (!form.date) e.date = 'Choose the date of absence.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    setSubmitting(true)
    setConfirmDup(false)
    try {
      const res = await absenceService.report({
        faculty_id: Number(form.faculty_id),
        date: form.date,
        reason: form.reason.trim(),
        remarks: form.remarks.trim(),
      })
      setResult(res)
      const n = res?.substitution_requests?.length || 0
      toast.success(n ? `Absence recorded. ${pluralize(n, 'substitution request')} created.` : 'Absence recorded. No classes were scheduled for that day.')
      setForm((f) => ({ ...f, reason: '', remarks: '' }))
      history.reload()
    } catch (err) {
      toast.error(errorMessage(err, 'The absence could not be recorded.'))
    } finally {
      setSubmitting(false)
    }
  }

  const onSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    if (duplicate) return setConfirmDup(true)
    submit()
  }

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase()
    return history.data.filter((a) => !q || [a.faculty_name, a.reason, a.faculty_department].filter(Boolean).some((v) => v.toLowerCase().includes(q)))
  }, [history.data, search])

  return (
    <div className="space-y-6">
      <PageHeader title="Absences" description="Report a faculty absence. SYNCORA finds that day's classes and ranks substitutes for each one." />

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        <section className="sheet lg:col-span-7" aria-labelledby="report-h">
          <SheetHeader title={<span id="report-h">Report an absence</span>} icon={UserX} />
          <form onSubmit={onSubmit} noValidate className="px-5 pb-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Faculty member" htmlFor="abs-fac" error={errors.faculty_id}>
                <select
                  id="abs-fac"
                  className="input"
                  value={form.faculty_id}
                  onChange={(e) => setForm({ ...form, faculty_id: e.target.value })}
                  disabled={faculty.loading}
                  aria-invalid={!!errors.faculty_id}
                >
                  <option value="">{faculty.loading ? 'Loading faculty…' : 'Choose a faculty member'}</option>
                  {faculty.data.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.department_name})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date" htmlFor="abs-date" error={errors.date} hint={weekday ? `A ${weekday}` : undefined}>
                <input id="abs-date" type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </Field>
            </div>

            <Field label="Reason" htmlFor="abs-reason" hint="Optional. Shared with administrators only.">
              <input id="abs-reason" className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="For example: medical leave" maxLength={300} />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {REASONS.map((r) => (
                  <button key={r} type="button" onClick={() => setForm({ ...form, reason: r })} className={`chip ${form.reason === r ? 'chip-accent' : 'chip-neutral'} hover:border-accent/50`}>
                    {r}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Remarks" htmlFor="abs-remarks" hint="Optional notes for the record.">
              <textarea id="abs-remarks" rows={3} className="input" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </Field>

            {/* Affected classes preview */}
            <div className="panel p-4">
              <p className="text-sm font-semibold text-ink flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-ink-3" />
                Classes affected
              </p>
              {!form.faculty_id ? (
                <p className="text-sm text-ink-2 mt-1">Choose a faculty member to see their classes on this day.</p>
              ) : weekday === 'Sunday' ? (
                <p className="text-sm text-ink-2 mt-1">No classes are timetabled on Sundays.</p>
              ) : affected.loading ? (
                <Skeleton className="h-10 mt-2" />
              ) : affected.error ? (
                <p className="text-sm text-danger-ink mt-1">{affected.error}</p>
              ) : affected.data.length === 0 ? (
                <p className="text-sm text-ink-2 mt-1">
                  {selectedFaculty?.name} has no classes on {weekday}s. The absence is still recorded and marked in attendance.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {affected.data.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 text-sm">
                      <span className="w-[92px] font-semibold text-ink tabular">
                        {hhmm(c.start_time)}–{hhmm(c.end_time)}
                      </span>
                      <span className="text-ink truncate">{c.subject_name}</span>
                      <span className="text-ink-2 truncate">
                        {c.class_name}
                        {c.section ? ` (${c.section})` : ''}
                        {c.classroom ? `, ${c.classroom}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {duplicate && (
              <div className="flex gap-2.5 rounded-panel bg-warn-soft border border-warn p-3 text-sm text-ink">
                <AlertTriangle className="w-4 h-4 text-warn-ink shrink-0 mt-0.5" />
                An absence is already recorded for {selectedFaculty?.name} on {formatDate(form.date)}. Reporting again creates duplicate substitution requests.
              </div>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    Recording and ranking…
                  </>
                ) : (
                  <>
                    <UserX className="w-4 h-4" />
                    Record absence
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <section className="sheet lg:col-span-5" aria-labelledby="result-h" aria-live="polite">
          <SheetHeader title={<span id="result-h">What happens next</span>} icon={ArrowLeftRight} />
          <div className="px-5 pb-5">
            {!result ? (
              <ol className="space-y-3 text-sm text-ink-2">
                {[
                  'The faculty member is marked absent for that date.',
                  'Each of their classes that day becomes a substitution request.',
                  'Present, free colleagues are ranked by the allocation rules.',
                  'You approve or reassign each request in the queue.',
                ].map((t, i) => (
                  <li key={t} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-surface-2 border border-line flex items-center justify-center text-xs font-bold text-ink shrink-0">{i + 1}</span>
                    <span className="pt-0.5">{t}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="space-y-3 animate-fade-up">
                <div className="flex gap-2.5 ground-verified rounded-panel p-3">
                  <CheckCircle2 className="w-5 h-5 text-ok-ink shrink-0" />
                  <p className="text-sm text-ink">
                    <span className="font-semibold">{result.faculty_name}</span> recorded absent on {formatDateLong(result.date)}.
                  </p>
                </div>
                {(result.substitution_requests || []).length === 0 ? (
                  <p className="text-sm text-ink-2">No classes were scheduled, so no cover is needed.</p>
                ) : (
                  <ul className="space-y-2">
                    {result.substitution_requests.map((r) => (
                      <li key={r.id} className="panel p-3 flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink truncate">
                            {hhmm(r.start_time)} {r.subject_name}
                          </p>
                          <p className="text-xs text-ink-2 truncate">{r.recommended_faculty_name ? `Recommended: ${r.recommended_faculty_name} (${Math.round(r.recommendation_score)}/100)` : 'No eligible substitute found'}</p>
                        </div>
                        <Badge status={r.status} />
                        <Link to={`/admin/substitutions?id=${r.id}`} className="btn-secondary btn-sm">
                          Review
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="sheet overflow-hidden" aria-labelledby="hist-h">
        <SheetHeader
          title={<span id="hist-h">Absence history</span>}
          description={history.loading ? 'Loading…' : `${pluralize(history.data.length, 'record')}`}
          icon={History}
          actions={<SearchInput value={search} onChange={setSearch} placeholder="Search name or reason" className="w-56 hidden sm:block" />}
        />
        <div className="sm:hidden px-5 pb-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name or reason" />
        </div>
        {history.loading ? (
          <div className="px-5 pb-5">
            <SkeletonRows rows={4} />
          </div>
        ) : history.error ? (
          <ErrorState message={history.error} onRetry={history.reload} />
        ) : filteredHistory.length === 0 ? (
          <EmptyState icon={History} title={search ? 'No matching absences' : 'No absences recorded'} description={search ? 'Try a different name or reason.' : 'Reported absences appear here with their cover status.'} />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto relative">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Faculty member</th>
                    <th>Date</th>
                    <th>Reason</th>
                    <th>Cover</th>
                    <th>Reported</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={a.faculty_name} size="sm" />
                          <div>
                            <p className="font-semibold text-ink">{a.faculty_name}</p>
                            <p className="text-xs text-ink-2">{a.faculty_department}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">{formatDate(a.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="max-w-[240px]">
                        <span className="text-ink">{a.reason || <span className="text-ink-3">Not given</span>}</span>
                      </td>
                      <td>
                        <CoverSummary requests={a.substitution_requests} />
                      </td>
                      <td className="text-ink-2 whitespace-nowrap">
                        {a.reported_by_name}
                        <span className="block text-xs text-ink-3">{relativeTime(a.created_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden divide-y divide-line">
              {filteredHistory.map((a) => (
                <li key={a.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-ink">{a.faculty_name}</p>
                    <span className="text-sm text-ink-2">{formatDate(a.date, { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <p className="text-sm text-ink-2">{a.reason || 'No reason given'}</p>
                  <div className="mt-1.5">
                    <CoverSummary requests={a.substitution_requests} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <ConfirmDialog
        isOpen={confirmDup}
        onClose={() => setConfirmDup(false)}
        onConfirm={submit}
        loading={submitting}
        title="Record a second absence?"
        confirmText="Record anyway"
        message={`${selectedFaculty?.name} already has an absence on ${formatDate(form.date)}. A second record creates new substitution requests for the same classes.`}
      />
    </div>
  )
}

function CoverSummary({ requests = [] }) {
  if (!requests.length) return <span className="text-sm text-ink-3">No classes</span>
  const covered = requests.filter((r) => ['APPROVED', 'ASSIGNED'].includes(r.status)).length
  const open = requests.filter((r) => ['PENDING', 'RECOMMENDED'].includes(r.status)).length
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={covered === requests.length ? 'chip-ok' : open ? 'chip-warn' : 'chip-neutral'}>
        {covered}/{requests.length} covered
      </span>
      {open > 0 && <span className="text-xs text-ink-2">{open} open</span>}
    </span>
  )
}

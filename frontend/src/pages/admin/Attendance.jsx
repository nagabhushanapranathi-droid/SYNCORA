import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Pencil, CalendarCheck, Info } from 'lucide-react'
import Modal from '../../components/Modal'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import { SkeletonRows } from '../../components/LoadingSpinner'
import { PageHeader, ErrorState, Segmented, SearchInput, Avatar, Field } from '../../components/ui'
import { attendanceService } from '../../services/attendanceService'
import { facultyService } from '../../services/facultyService'
import { errorMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import useLoad from '../../lib/useLoad'
import { asList, isoDate, parseISODate, formatDateLong, hhmm } from '../../lib/format'

export default function Attendance() {
  const toast = useToast()
  const [date, setDate] = useState(isoDate())
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)

  const summary = useLoad(() => attendanceService.getToday({ date }), [date])
  const faculty = useLoad(() => facultyService.getAll().then((d) => asList(d)), [], { initial: [] })

  const rows = useMemo(() => {
    const records = summary.data?.records || []
    const byFaculty = Object.fromEntries(records.map((r) => [r.faculty_id, r]))
    const active = faculty.data.filter((f) => f.is_active !== false)
    const merged = active.map((f) => ({ faculty: f, record: byFaculty[f.id] || null, status: byFaculty[f.id]?.status || 'NOT_MARKED' }))
    // Records for faculty no longer active still show.
    records.forEach((r) => {
      if (!active.some((f) => f.id === r.faculty_id))
        merged.push({ faculty: { id: r.faculty_id, name: r.faculty_name, department_name: r.faculty_department }, record: r, status: r.status })
    })
    return merged.sort((a, b) => a.faculty.name.localeCompare(b.faculty.name))
  }, [summary.data, faculty.data])

  const counts = useMemo(() => {
    const c = { all: rows.length, PRESENT: 0, ABSENT: 0, LOGGED_OUT: 0, NOT_MARKED: 0 }
    rows.forEach((r) => (c[r.status] = (c[r.status] || 0) + 1))
    return c
  }, [rows])

  const visible = rows.filter(
    (r) =>
      (tab === 'all' || r.status === tab) &&
      (!search.trim() || [r.faculty.name, r.faculty.department_name].filter(Boolean).some((v) => v.toLowerCase().includes(search.trim().toLowerCase())))
  )

  const shiftDay = (n) => {
    const d = parseISODate(date)
    d.setDate(d.getDate() + n)
    setDate(isoDate(d))
  }

  const loading = summary.loading || faculty.loading
  const error = summary.error || faculty.error

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance"
        description="Faculty check-ins for the day. Only colleagues marked present with a check-in time are considered for cover."
        actions={
          <div className="flex items-center gap-1.5">
            <button type="button" className="btn-icon border border-line bg-surface" onClick={() => shiftDay(-1)} aria-label="Previous day">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input type="date" aria-label="Attendance date" className="input w-[170px]" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <button type="button" className="btn-icon border border-line bg-surface" onClick={() => shiftDay(1)} aria-label="Next day">
              <ChevronRight className="w-4 h-4" />
            </button>
            {date !== isoDate() && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setDate(isoDate())}>
                Today
              </button>
            )}
          </div>
        }
      >
        <p className="mt-2 text-sm font-semibold text-ink">{formatDateLong(date)}</p>
      </PageHeader>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <Segmented
          label="Attendance status"
          value={tab}
          onChange={setTab}
          options={[
            { id: 'all', label: 'Everyone', count: counts.all },
            { id: 'PRESENT', label: 'Present', count: counts.PRESENT },
            { id: 'ABSENT', label: 'Absent', count: counts.ABSENT },
            { id: 'LOGGED_OUT', label: 'Logged out', count: counts.LOGGED_OUT },
            { id: 'NOT_MARKED', label: 'Not marked', count: counts.NOT_MARKED },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or department" className="lg:ml-auto lg:w-72" />
      </div>

      <section className="sheet overflow-hidden" aria-label="Attendance records">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => { summary.reload(); faculty.reload() }} />
        ) : visible.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="Nobody in this view" description="Choose another status or clear the search." />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto relative">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Faculty member</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Notes</th>
                    <th className="text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.faculty.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={r.faculty.name} size="sm" />
                          <div>
                            <p className="font-semibold text-ink">{r.faculty.name}</p>
                            {r.faculty.designation && <p className="text-xs text-ink-2">{r.faculty.designation}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="text-ink-2">{r.faculty.department_name || '—'}</td>
                      <td>
                        <Badge status={r.status} />
                      </td>
                      <td className="tabular">{hhmm(r.record?.login_time) || <span className="text-ink-3">—</span>}</td>
                      <td className="tabular">{hhmm(r.record?.logout_time) || <span className="text-ink-3">—</span>}</td>
                      <td className="max-w-[220px] text-ink-2 truncate" title={r.record?.notes || ''}>
                        {r.record?.notes || <span className="text-ink-3">—</span>}
                      </td>
                      <td className="text-right">
                        <button type="button" onClick={() => setEditing(r)} className="btn-secondary btn-sm">
                          <Pencil className="w-3.5 h-3.5" />
                          {r.record ? 'Edit' : 'Mark'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden divide-y divide-line">
              {visible.map((r) => (
                <li key={r.faculty.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={r.faculty.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink truncate">{r.faculty.name}</p>
                    <p className="text-xs text-ink-2">
                      {r.record?.login_time ? `In ${hhmm(r.record.login_time)}` : 'No check-in'}
                      {r.record?.logout_time ? `, out ${hhmm(r.record.logout_time)}` : ''}
                    </p>
                  </div>
                  <Badge status={r.status} />
                  <button type="button" onClick={() => setEditing(r)} className="btn-icon" aria-label={`Edit attendance for ${r.faculty.name}`}>
                    <Pencil className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <EditAttendance
        row={editing}
        date={date}
        onClose={() => setEditing(null)}
        onSaved={(name) => {
          toast.success(`Attendance updated for ${name}.`)
          setEditing(null)
          summary.reload()
        }}
      />
    </div>
  )
}

function EditAttendance({ row, date, onClose, onSaved }) {
  const [form, setForm] = useState({ status: 'PRESENT', login_time: '', logout_time: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!row) return
    const r = row.record
    setForm({
      status: r?.status || 'PRESENT',
      login_time: hhmm(r?.login_time) || (r ? '' : '09:00'),
      logout_time: hhmm(r?.logout_time) || '',
      notes: r?.notes || '',
    })
    setError('')
  }, [row])

  if (!row) return null

  const save = async (e) => {
    e.preventDefault()
    if (form.status === 'PRESENT' && !form.login_time) return setError('A present faculty member needs a check-in time.')
    if (form.login_time && form.logout_time && form.logout_time <= form.login_time) return setError('Check-out must be after check-in.')
    setSaving(true)
    setError('')
    const payload = {
      status: form.status,
      login_time: form.login_time || null,
      logout_time: form.logout_time || null,
      notes: form.notes.trim(),
    }
    try {
      if (row.record) await attendanceService.override(row.record.id, payload)
      else await attendanceService.mark({ faculty_id: row.faculty.id, date, ...payload, login_time: payload.login_time || undefined, logout_time: payload.logout_time || undefined })
      onSaved(row.faculty.name)
    } catch (err) {
      setError(errorMessage(err, 'Attendance could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={!!row}
      onClose={onClose}
      closeDisabled={saving}
      title={row.record ? 'Edit attendance' : 'Mark attendance'}
      subtitle={`${row.faculty.name}, ${formatDateLong(date)}`}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="att-form" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save attendance'}
          </button>
        </>
      }
    >
      <form id="att-form" onSubmit={save} className="space-y-4">
        {error && (
          <p className="rounded-panel bg-danger-soft border border-danger/30 p-3 text-sm text-ink" role="alert">
            {error}
          </p>
        )}
        <Field label="Status">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Status">
            {[
              ['PRESENT', 'Present'],
              ['ABSENT', 'Absent'],
              ['LOGGED_OUT', 'Logged out'],
            ].map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={form.status === v}
                onClick={() => setForm({ ...form, status: v })}
                className={`h-10 rounded-ctl border text-sm font-semibold transition-colors ${form.status === v ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-strong bg-surface text-ink-2 hover:text-ink'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-in" htmlFor="att-in">
            <input id="att-in" type="time" className="input" value={form.login_time} onChange={(e) => setForm({ ...form, login_time: e.target.value })} />
          </Field>
          <Field label="Check-out" htmlFor="att-out">
            <input id="att-out" type="time" className="input" value={form.logout_time} onChange={(e) => setForm({ ...form, logout_time: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes" htmlFor="att-notes" hint="Saved with the override for audit.">
          <textarea id="att-notes" rows={2} maxLength={200} className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        {form.status === 'ABSENT' && (
          <p className="flex gap-2 text-sm text-ink-2 panel p-3">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-info-ink" />
            <span>
              Marking someone absent here does not arrange cover. To create substitution requests for their classes,{' '}
              <Link to="/admin/absences" className="font-semibold text-accent-ink hover:underline">
                report the absence
              </Link>
              .
            </span>
          </p>
        )}
      </form>
    </Modal>
  )
}

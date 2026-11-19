import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, UserMinus, Eye, BookOpen, Users, Mail, History, Check } from 'lucide-react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import { SkeletonRows, Skeleton } from '../../components/LoadingSpinner'
import { PageHeader, ErrorState, SearchInput, Avatar, Field, Meta, Segmented } from '../../components/ui'
import { facultyService } from '../../services/facultyService'
import { departmentService } from '../../services/departmentService'
import { subjectService } from '../../services/subjectService'
import { errorMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import useLoad from '../../lib/useLoad'
import { asList, pluralize } from '../../lib/format'

const DESIGNATIONS = ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Adjunct Faculty']

export default function Faculty() {
  const toast = useToast()
  const list = useLoad(() => facultyService.getAll().then((d) => asList(d)), [], { initial: [] })
  const departments = useLoad(() => departmentService.getAll().then((d) => asList(d)), [], { initial: [] })
  const subjects = useLoad(() => subjectService.getAll().then((d) => asList(d)), [], { initial: [] })

  const [search, setSearch] = useState('')
  const [dept, setDept] = useState('')
  const [status, setStatus] = useState('active')
  const [editing, setEditing] = useState(null) // null | {} (new) | faculty
  const [subjectsFor, setSubjectsFor] = useState(null)
  const [profile, setProfile] = useState(null)
  const [deactivating, setDeactivating] = useState(null)
  const [busy, setBusy] = useState(false)

  const counts = {
    active: list.data.filter((f) => f.is_active !== false).length,
    inactive: list.data.filter((f) => f.is_active === false).length,
    all: list.data.length,
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return list.data
      .filter((f) => (status === 'all' ? true : status === 'active' ? f.is_active !== false : f.is_active === false))
      .filter((f) => !dept || String(f.department_id) === dept)
      .filter((f) => !q || [f.name, f.email, f.designation, f.specialization, f.department_name].filter(Boolean).some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [list.data, search, dept, status])

  const deactivate = async () => {
    setBusy(true)
    try {
      await facultyService.delete(deactivating.id)
      toast.success(`${deactivating.name} has been deactivated.`)
      setDeactivating(null)
      list.reload()
    } catch (err) {
      toast.error(errorMessage(err, 'The faculty member could not be deactivated.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Faculty"
        description="The directory used for timetabling and cover. Qualified subjects drive the substitute ranking."
        actions={
          <button type="button" className="btn-primary" onClick={() => setEditing({})} disabled={departments.loading}>
            <Plus className="w-4 h-4" />
            Add faculty member
          </button>
        }
      />

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <Segmented
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { id: 'active', label: 'Active', count: counts.active },
            { id: 'inactive', label: 'Inactive', count: counts.inactive },
            { id: 'all', label: 'All', count: counts.all },
          ]}
        />
        <div className="flex flex-col sm:flex-row gap-3 lg:ml-auto">
          <select aria-label="Department" className="input sm:w-56" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {departments.data.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or specialization" className="sm:w-80" />
        </div>
      </div>

      <section className="sheet overflow-hidden" aria-label="Faculty directory">
        {list.loading ? (
          <div className="p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={list.data.length ? 'No faculty match' : 'No faculty yet'}
            description={list.data.length ? 'Adjust the search, department or status filter.' : 'Add your first faculty member to start building the timetable.'}
            actionLabel={list.data.length ? '' : 'Add faculty member'}
            onAction={() => setEditing({})}
          />
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto relative">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Faculty member</th>
                    <th>Department</th>
                    <th>Qualified subjects</th>
                    <th>Today</th>
                    <th className="text-right">Cover duties</th>
                    <th className="text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => (
                    <tr key={f.id} className={f.is_active === false ? 'opacity-60' : ''}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={f.name} />
                          <div className="min-w-0">
                            <p className="font-semibold text-ink">{f.name}</p>
                            <p className="text-xs text-ink-2">
                              {f.designation}
                              {f.specialization ? `, ${f.specialization}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="text-ink-2">{f.department_name}</td>
                      <td>
                        <SubjectChips subjects={f.subjects} onEdit={() => setSubjectsFor(f)} />
                      </td>
                      <td>{f.is_active === false ? <Badge status="INACTIVE" /> : <Badge status={f.today_attendance?.status || 'NOT_MARKED'} />}</td>
                      <td className="text-right font-semibold text-ink tabular">{f.substitution_count ?? 0}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button type="button" className="btn-icon" onClick={() => setProfile(f)} aria-label={`View ${f.name}`} title="View profile">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button type="button" className="btn-icon" onClick={() => setEditing(f)} aria-label={`Edit ${f.name}`} title="Edit details">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {f.is_active !== false && (
                            <button type="button" className="btn-icon hover:!text-danger-ink" onClick={() => setDeactivating(f)} aria-label={`Deactivate ${f.name}`} title="Deactivate">
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="lg:hidden divide-y divide-line">
              {filtered.map((f) => (
                <li key={f.id} className={`px-4 py-4 ${f.is_active === false ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <Avatar name={f.name} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{f.name}</p>
                      <p className="text-xs text-ink-2">
                        {f.designation}, {f.department_name}
                      </p>
                      <div className="mt-2">
                        <SubjectChips subjects={f.subjects} onEdit={() => setSubjectsFor(f)} />
                      </div>
                    </div>
                    {f.is_active === false ? <Badge status="INACTIVE" /> : <Badge status={f.today_attendance?.status || 'NOT_MARKED'} />}
                  </div>
                  <div className="flex gap-2 mt-3 ml-12">
                    <button type="button" className="btn-secondary btn-sm" onClick={() => setProfile(f)}>
                      View
                    </button>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(f)}>
                      Edit
                    </button>
                    {f.is_active !== false && (
                      <button type="button" className="btn-danger-ghost btn-sm" onClick={() => setDeactivating(f)}>
                        Deactivate
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <FacultyForm
        faculty={editing}
        onClose={() => setEditing(null)}
        departments={departments.data}
        subjects={subjects.data}
        onSaved={(msg) => {
          toast.success(msg)
          setEditing(null)
          list.reload()
        }}
      />
      <SubjectAssign
        faculty={subjectsFor}
        subjects={subjects.data}
        onClose={() => setSubjectsFor(null)}
        onSaved={(name) => {
          toast.success(`Qualified subjects updated for ${name}.`)
          setSubjectsFor(null)
          list.reload()
        }}
      />
      <ProfileModal faculty={profile} onClose={() => setProfile(null)} />
      <ConfirmDialog
        isOpen={!!deactivating}
        onClose={() => setDeactivating(null)}
        onConfirm={deactivate}
        loading={busy}
        isDestructive
        title={`Deactivate ${deactivating?.name || ''}?`}
        confirmText="Deactivate"
        message="They can no longer sign in and will not be ranked as a substitute. Their timetable entries and past cover history are kept, so reassign their classes in the timetable."
      />
    </div>
  )
}

function SubjectChips({ subjects = [], onEdit }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 max-w-[320px]">
      {subjects.length === 0 && <span className="text-sm text-ink-3">None yet</span>}
      {subjects.slice(0, 3).map((s) => (
        <span key={s.id} className="chip-neutral font-medium" title={s.name}>
          {s.code}
        </span>
      ))}
      {subjects.length > 3 && <span className="text-xs text-ink-2">+{subjects.length - 3}</span>}
      <button type="button" onClick={onEdit} className="text-xs font-semibold text-accent-ink hover:underline ml-0.5">
        Edit
      </button>
    </div>
  )
}

function FacultyForm({ faculty, onClose, departments, subjects, onSaved }) {
  const isNew = faculty && !faculty.id
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!faculty) return
    setError('')
    setForm({
      name: faculty.name || '',
      email: faculty.email || '',
      password: '',
      department_id: faculty.department_id ? String(faculty.department_id) : departments[0] ? String(departments[0].id) : '',
      designation: faculty.designation || 'Assistant Professor',
      specialization: faculty.specialization || '',
      subject_ids: (faculty.subjects || []).map((s) => s.id),
    })
  }, [faculty, departments])

  if (!faculty) return null
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || (isNew && !form.email.trim()) || !form.department_id || !form.designation) return setError('Name, email, department and designation are required.')
    if (isNew && form.password && form.password.length < 8) return setError('Use at least 8 characters for the initial password.')
    setSaving(true)
    setError('')
    try {
      if (isNew) {
        const payload = {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          department_id: Number(form.department_id),
          designation: form.designation,
          specialization: form.specialization.trim(),
          subject_ids: form.subject_ids,
        }
        if (form.password) payload.password = form.password
        await facultyService.create(payload)
        onSaved(`${payload.name} added. They can sign in with their email.`)
      } else {
        await facultyService.update(faculty.id, {
          name: form.name.trim(),
          department_id: Number(form.department_id),
          designation: form.designation,
          specialization: form.specialization.trim(),
        })
        onSaved(`${form.name.trim()}'s details were updated.`)
      }
    } catch (err) {
      setError(errorMessage(err, 'The faculty record could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={!!faculty}
      onClose={onClose}
      closeDisabled={saving}
      title={isNew ? 'Add a faculty member' : `Edit ${faculty.name}`}
      subtitle={isNew ? 'A sign-in account is created with the same email.' : 'Email is the sign-in identity and cannot be changed here.'}
      maxWidth="max-w-xl"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="fac-form" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add faculty member' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="fac-form" onSubmit={submit} className="space-y-4">
        {error && (
          <p className="rounded-panel bg-danger-soft border border-danger/30 p-3 text-sm text-ink" role="alert">
            {error}
          </p>
        )}
        <Field label="Full name" htmlFor="fac-name">
          <input id="fac-name" className="input" value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="Dr. Jane Smith" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="fac-email">
            <input id="fac-email" type="email" className="input" value={form.email || ''} onChange={(e) => set('email', e.target.value)} disabled={!isNew} placeholder="jane.smith@syncora.edu" />
          </Field>
          {isNew && (
            <Field label="Initial password" htmlFor="fac-pw" hint="Leave blank to use the institution default.">
              <input id="fac-pw" type="password" autoComplete="new-password" className="input" value={form.password || ''} onChange={(e) => set('password', e.target.value)} />
            </Field>
          )}
          <Field label="Department" htmlFor="fac-dept">
            <select id="fac-dept" className="input" value={form.department_id || ''} onChange={(e) => set('department_id', e.target.value)}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Designation" htmlFor="fac-des">
            <select id="fac-des" className="input" value={form.designation || ''} onChange={(e) => set('designation', e.target.value)}>
              {[...new Set([...DESIGNATIONS, form.designation].filter(Boolean))].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Specialization" htmlFor="fac-spec" hint="Used by the ranking to spot related expertise.">
          <input id="fac-spec" className="input" value={form.specialization || ''} onChange={(e) => set('specialization', e.target.value)} placeholder="Machine learning, data structures" />
        </Field>
        {isNew && subjects.length > 0 && (
          <Field label="Qualified subjects">
            <SubjectChecklist subjects={subjects} value={form.subject_ids || []} onChange={(v) => set('subject_ids', v)} />
          </Field>
        )}
      </form>
    </Modal>
  )
}

function SubjectChecklist({ subjects, value, onChange }) {
  const byDept = useMemo(() => {
    const g = {}
    subjects.forEach((s) => (g[s.department_name || 'Other'] = g[s.department_name || 'Other'] || []).push(s))
    return Object.entries(g)
  }, [subjects])
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
      {byDept.map(([dept, list]) => (
        <fieldset key={dept}>
          <legend className="text-xs font-semibold text-ink-2 mb-1.5">{dept}</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {list.map((s) => {
              const on = value.includes(s.id)
              return (
                <label key={s.id} className={`flex items-center gap-2.5 rounded-ctl border px-3 py-2 cursor-pointer transition-colors ${on ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'}`}>
                  <input type="checkbox" className="check" checked={on} onChange={() => toggle(s.id)} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink truncate">{s.name}</span>
                    <span className="block text-xs text-ink-2">{s.code}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

function SubjectAssign({ faculty, subjects, onClose, onSaved }) {
  const [value, setValue] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (faculty) {
      setValue((faculty.subjects || []).map((s) => s.id))
      setError('')
    }
  }, [faculty])
  if (!faculty) return null
  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await facultyService.assignSubjects(faculty.id, value)
      onSaved(faculty.name)
    } catch (err) {
      setError(errorMessage(err, 'Subjects could not be updated.'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal
      isOpen={!!faculty}
      onClose={onClose}
      closeDisabled={saving}
      title="Qualified subjects"
      subtitle={`${faculty.name} can be ranked as an expert substitute for these subjects.`}
      maxWidth="max-w-xl"
      footer={
        <>
          <span className="mr-auto text-sm text-ink-2">{pluralize(value.length, 'subject')} selected</span>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            <Check className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save subjects'}
          </button>
        </>
      }
    >
      {error && (
        <p className="mb-3 rounded-panel bg-danger-soft border border-danger/30 p-3 text-sm text-ink" role="alert">
          {error}
        </p>
      )}
      {subjects.length === 0 ? (
        <EmptyState compact icon={BookOpen} title="No subjects yet" description="Create subjects under Departments & subjects first." />
      ) : (
        <SubjectChecklist subjects={subjects} value={value} onChange={setValue} />
      )}
    </Modal>
  )
}

function ProfileModal({ faculty, onClose }) {
  const history = useLoad(() => (faculty ? facultyService.getHistory(faculty.id) : Promise.resolve(null)), [faculty?.id], { enabled: !!faculty })
  if (!faculty) return null
  const items = history.data?.history || []
  const att = faculty.today_attendance
  return (
    <Modal isOpen={!!faculty} onClose={onClose} title={faculty.name} subtitle={faculty.designation} maxWidth="max-w-2xl">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar name={faculty.name} size="xl" />
          <div className="min-w-0">
            <p className="text-sm text-ink-2 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              {faculty.email}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge status={faculty.is_active === false ? 'INACTIVE' : 'ACTIVE'} />
              {faculty.is_active !== false && <Badge status={att?.status || 'NOT_MARKED'} label={`Today: ${att?.status ? att.status.replace('_', ' ').toLowerCase() : 'not marked'}`} />}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <Meta label="Department">{faculty.department_name}</Meta>
          <Meta label="Specialization">{faculty.specialization || 'Not set'}</Meta>
          <Meta label="Cover duties approved">{faculty.substitution_count ?? 0}</Meta>
        </dl>

        <div>
          <h3 className="font-heading font-bold text-ink mb-2">Qualified subjects</h3>
          {(faculty.subjects || []).length === 0 ? (
            <p className="text-sm text-ink-2">No subjects assigned. They can still be ranked as a non-expert fallback.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {faculty.subjects.map((s) => (
                <li key={s.id} className="chip-neutral font-medium">
                  {s.name} <span className="text-ink-3">{s.code}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="font-heading font-bold text-ink mb-2 flex items-center gap-2">
            <History className="w-4 h-4 text-ink-3" />
            Cover history
          </h3>
          {history.loading ? (
            <Skeleton className="h-20" />
          ) : history.error ? (
            <ErrorState compact message={history.error} onRetry={history.reload} />
          ) : items.length === 0 ? (
            <p className="text-sm text-ink-2">No cover duties recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line rounded-panel border border-line max-h-60 overflow-y-auto">
              {items.map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink truncate">{h.subject}</p>
                    <p className="text-xs text-ink-2">
                      {h.class_name}, {h.date}
                    </p>
                  </div>
                  <Badge status={h.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Building2, BookOpen, Users, CalendarDays } from 'lucide-react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import { SkeletonRows } from '../../components/LoadingSpinner'
import { PageHeader, ErrorState, Segmented, SearchInput, Field, Avatar } from '../../components/ui'
import { departmentService } from '../../services/departmentService'
import { subjectService } from '../../services/subjectService'
import { facultyService } from '../../services/facultyService'
import { timetableService } from '../../services/timetableService'
import { errorMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import useLoad from '../../lib/useLoad'
import { asList, pluralize } from '../../lib/format'

export default function Academics() {
  const toast = useToast()
  const [tab, setTab] = useState('departments')
  const departments = useLoad(() => departmentService.getAll().then((d) => asList(d)), [], { initial: [] })
  const subjects = useLoad(() => subjectService.getAll().then((d) => asList(d)), [], { initial: [] })
  const faculty = useLoad(() => facultyService.getAll().then((d) => asList(d)), [], { initial: [] })
  const timetable = useLoad(() => timetableService.getAll().then((d) => asList(d)), [], { initial: [] })

  const [editingDept, setEditingDept] = useState(null)
  const [editingSubj, setEditingSubj] = useState(null)
  const [deleting, setDeleting] = useState(null) // {kind, item}
  const [openDept, setOpenDept] = useState(null)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')

  const activeFaculty = faculty.data.filter((f) => f.is_active !== false)
  const deptStats = useMemo(() => {
    const s = {}
    departments.data.forEach((d) => {
      s[d.id] = {
        faculty: activeFaculty.filter((f) => f.department_id === d.id),
        subjects: subjects.data.filter((x) => x.department_id === d.id),
        classes: timetable.data.filter((t) => t.department_id === d.id).length,
      }
    })
    return s
  }, [departments.data, activeFaculty, subjects.data, timetable.data])

  const subjStats = useMemo(() => {
    const s = {}
    subjects.data.forEach((x) => {
      s[x.id] = {
        qualified: activeFaculty.filter((f) => f.subjects?.some((y) => y.id === x.id)),
        classes: timetable.data.filter((t) => t.subject_id === x.id).length,
      }
    })
    return s
  }, [subjects.data, activeFaculty, timetable.data])

  const filteredSubjects = subjects.data.filter(
    (x) =>
      (!deptFilter || String(x.department_id) === deptFilter) &&
      (!search.trim() || [x.name, x.code, x.department_name].filter(Boolean).some((v) => v.toLowerCase().includes(search.trim().toLowerCase())))
  )

  const doDelete = async () => {
    setBusy(true)
    try {
      if (deleting.kind === 'dept') await departmentService.delete(deleting.item.id)
      else await subjectService.delete(deleting.item.id)
      toast.success(`${deleting.item.name} deleted.`)
      setDeleting(null)
      departments.reload()
      subjects.reload()
    } catch (err) {
      toast.error(errorMessage(err, 'It could not be deleted.'))
    } finally {
      setBusy(false)
    }
  }

  const loading = departments.loading || subjects.loading
  const error = departments.error || subjects.error

  return (
    <div className="space-y-5">
      <PageHeader
        title="Departments & subjects"
        description="The academic structure behind the timetable. Subjects belong to a department; faculty are qualified per subject."
        actions={
          tab === 'departments' ? (
            <button type="button" className="btn-primary" onClick={() => setEditingDept({})}>
              <Plus className="w-4 h-4" />
              Add department
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => setEditingSubj({})} disabled={!departments.data.length}>
              <Plus className="w-4 h-4" />
              Add subject
            </button>
          )
        }
      />

      <Segmented
        label="Section"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'departments', label: 'Departments', count: departments.data.length, icon: Building2 },
          { id: 'subjects', label: 'Subjects', count: subjects.data.length, icon: BookOpen },
        ]}
      />

      {error ? (
        <div className="sheet">
          <ErrorState message={error} onRetry={() => { departments.reload(); subjects.reload() }} />
        </div>
      ) : loading ? (
        <div className="sheet p-5">
          <SkeletonRows rows={4} />
        </div>
      ) : tab === 'departments' ? (
        departments.data.length === 0 ? (
          <div className="sheet">
            <EmptyState icon={Building2} title="No departments yet" description="Departments group subjects, faculty and classes." actionLabel="Add department" onAction={() => setEditingDept({})} />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {departments.data.map((d) => {
              const st = deptStats[d.id] || { faculty: [], subjects: [], classes: 0 }
              return (
                <article key={d.id} className="sheet p-5 flex flex-col">
                  <div className="flex items-start gap-3">
                    <span className="font-heading font-black text-sm rounded-md bg-surface-2 border border-line px-2 py-1 text-ink tracking-wide">{d.code}</span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-heading font-extrabold text-lg text-ink">{d.name}</h2>
                      <p className="text-sm text-ink-2 mt-0.5">{d.description || 'No description yet.'}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 mt-4">
                    {[
                      ['Faculty', st.faculty.length, Users],
                      ['Subjects', st.subjects.length, BookOpen],
                      ['Classes a week', st.classes, CalendarDays],
                    ].map(([label, n, Icon]) => (
                      <div key={label} className="panel px-3 py-2.5">
                        <dt className="text-xs text-ink-2 flex items-center gap-1">
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </dt>
                        <dd className="font-heading font-black text-xl text-ink tabular">{n}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex items-center gap-2 mt-4 pt-4 rule">
                    <button type="button" className="btn-secondary btn-sm" onClick={() => setOpenDept(d)}>
                      View details
                    </button>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setEditingDept(d)}>
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger-ghost btn-sm ml-auto"
                      onClick={() => setDeleting({ kind: 'dept', item: d })}
                      disabled={st.faculty.length > 0 || st.subjects.length > 0}
                      title={st.faculty.length || st.subjects.length ? 'Move its faculty and subjects first' : 'Delete department'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )
      ) : (
        <section className="sheet overflow-hidden">
          <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-line">
            <select aria-label="Department" className="input sm:w-60" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="">All departments</option>
              {departments.data.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <SearchInput value={search} onChange={setSearch} placeholder="Search subject name or code" className="sm:ml-auto sm:w-72" />
          </div>
          {filteredSubjects.length === 0 ? (
            <EmptyState icon={BookOpen} title={subjects.data.length ? 'No subjects match' : 'No subjects yet'} description={subjects.data.length ? 'Clear the filters to see all subjects.' : 'Add subjects so classes can be timetabled.'} />
          ) : (
            <div className="overflow-x-auto relative">
              <table className="tbl min-w-[720px]">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Department</th>
                    <th>Qualified faculty</th>
                    <th className="text-right">Classes a week</th>
                    <th className="text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubjects.map((x) => {
                    const st = subjStats[x.id] || { qualified: [], classes: 0 }
                    return (
                      <tr key={x.id}>
                        <td>
                          <p className="font-semibold text-ink">{x.name}</p>
                          <p className="text-xs text-ink-2">
                            {x.code}
                            {x.description ? `, ${x.description}` : ''}
                          </p>
                        </td>
                        <td className="text-ink-2">{x.department_name}</td>
                        <td>
                          {st.qualified.length === 0 ? (
                            <span className="text-sm text-warn-ink font-medium">Nobody yet</span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <span className="flex -space-x-1.5">
                                {st.qualified.slice(0, 4).map((f) => (
                                  <span key={f.id} title={f.name} className="ring-2 ring-surface rounded-full">
                                    <Avatar name={f.name} size="xs" />
                                  </span>
                                ))}
                              </span>
                              <span className="text-sm text-ink-2">{st.qualified.length}</span>
                            </span>
                          )}
                        </td>
                        <td className="text-right font-semibold tabular">{st.classes}</td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <button type="button" className="btn-icon" onClick={() => setEditingSubj(x)} aria-label={`Edit ${x.name}`}>
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button type="button" className="btn-icon hover:!text-danger-ink disabled:opacity-40" onClick={() => setDeleting({ kind: 'subj', item: x })} disabled={st.classes > 0} title={st.classes ? 'Remove it from the timetable first' : 'Delete subject'} aria-label={`Delete ${x.name}`}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <DeptForm
        dept={editingDept}
        onClose={() => setEditingDept(null)}
        onSaved={(m) => {
          toast.success(m)
          setEditingDept(null)
          departments.reload()
        }}
      />
      <SubjectForm
        subject={editingSubj}
        departments={departments.data}
        onClose={() => setEditingSubj(null)}
        onSaved={(m) => {
          toast.success(m)
          setEditingSubj(null)
          subjects.reload()
        }}
      />
      <DeptDetail dept={openDept} stats={openDept ? deptStats[openDept.id] : null} subjStats={subjStats} onClose={() => setOpenDept(null)} />
      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        loading={busy}
        isDestructive
        title={`Delete ${deleting?.item?.name || ''}?`}
        confirmText="Delete"
        message={deleting?.kind === 'dept' ? 'The department is removed permanently.' : 'The subject is removed permanently, along with faculty qualifications for it.'}
      />
    </div>
  )
}

function DeptForm({ dept, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', code: '', description: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (dept) {
      setForm({ name: dept.name || '', code: dept.code || '', description: dept.description || '' })
      setError('')
    }
  }, [dept])
  if (!dept) return null
  const isNew = !dept.id
  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.code.trim()) return setError('Name and code are required.')
    setSaving(true)
    setError('')
    try {
      const payload = { name: form.name.trim(), code: form.code.trim().toUpperCase(), description: form.description.trim() }
      if (isNew) await departmentService.create(payload)
      else await departmentService.update(dept.id, payload)
      onSaved(isNew ? `${payload.name} added.` : `${payload.name} updated.`)
    } catch (err) {
      setError(errorMessage(err, 'The department could not be saved.'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal
      isOpen
      onClose={onClose}
      closeDisabled={saving}
      title={isNew ? 'Add a department' : `Edit ${dept.name}`}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="dept-form" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add department' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="dept-form" onSubmit={submit} className="space-y-4">
        {error && <p className="rounded-panel bg-danger-soft border border-danger/30 p-3 text-sm text-ink" role="alert">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Name" htmlFor="d-name">
            <input id="d-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Computer Science" />
          </Field>
          <Field label="Code" htmlFor="d-code" hint="Unique, short">
            <input id="d-code" className="input uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CS" maxLength={20} />
          </Field>
        </div>
        <Field label="Description" htmlFor="d-desc">
          <textarea id="d-desc" rows={3} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </form>
    </Modal>
  )
}

function SubjectForm({ subject, departments, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', code: '', department_id: '', description: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (subject) {
      setForm({
        name: subject.name || '',
        code: subject.code || '',
        department_id: subject.department_id ? String(subject.department_id) : departments[0] ? String(departments[0].id) : '',
        description: subject.description || '',
      })
      setError('')
    }
  }, [subject, departments])
  if (!subject) return null
  const isNew = !subject.id
  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.code.trim() || !form.department_id) return setError('Name, code and department are required.')
    setSaving(true)
    setError('')
    try {
      const payload = { name: form.name.trim(), code: form.code.trim().toUpperCase(), department_id: Number(form.department_id), description: form.description.trim() }
      if (isNew) await subjectService.create(payload)
      else await subjectService.update(subject.id, payload)
      onSaved(isNew ? `${payload.name} added.` : `${payload.name} updated.`)
    } catch (err) {
      setError(errorMessage(err, 'The subject could not be saved.'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal
      isOpen
      onClose={onClose}
      closeDisabled={saving}
      title={isNew ? 'Add a subject' : `Edit ${subject.name}`}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="subj-form" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add subject' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="subj-form" onSubmit={submit} className="space-y-4">
        {error && <p className="rounded-panel bg-danger-soft border border-danger/30 p-3 text-sm text-ink" role="alert">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
          <Field label="Name" htmlFor="s-name">
            <input id="s-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Data Structures" />
          </Field>
          <Field label="Code" htmlFor="s-code" hint="Unique">
            <input id="s-code" className="input uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CS201" maxLength={20} />
          </Field>
        </div>
        <Field label="Department" htmlFor="s-dept">
          <select id="s-dept" className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description" htmlFor="s-desc" hint="Optional. Helps the lesson planner with context.">
          <textarea id="s-desc" rows={3} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </form>
    </Modal>
  )
}

function DeptDetail({ dept, stats, subjStats, onClose }) {
  if (!dept || !stats) return null
  return (
    <Modal isOpen onClose={onClose} title={dept.name} subtitle={`${dept.code}, ${pluralize(stats.classes, 'class', 'classes')} a week`} maxWidth="max-w-2xl">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="font-heading font-bold text-ink mb-2">Subjects</h3>
          {stats.subjects.length === 0 ? (
            <p className="text-sm text-ink-2">No subjects in this department.</p>
          ) : (
            <ul className="space-y-1.5">
              {stats.subjects.map((s) => (
                <li key={s.id} className="panel px-3 py-2">
                  <p className="text-sm font-semibold text-ink">{s.name}</p>
                  <p className="text-xs text-ink-2">
                    {s.code}, {pluralize(subjStats[s.id]?.qualified.length || 0, 'qualified teacher')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="font-heading font-bold text-ink mb-2">Faculty</h3>
          {stats.faculty.length === 0 ? (
            <p className="text-sm text-ink-2">No active faculty in this department.</p>
          ) : (
            <ul className="space-y-1.5">
              {stats.faculty.map((f) => (
                <li key={f.id} className="flex items-center gap-2.5 panel px-3 py-2">
                  <Avatar name={f.name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{f.name}</p>
                    <p className="text-xs text-ink-2 truncate">{f.designation}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}

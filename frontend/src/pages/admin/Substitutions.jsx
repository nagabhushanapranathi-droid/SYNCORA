import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeftRight,
  Check,
  X,
  UserCheck,
  PauseCircle,
  RefreshCw,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Clock,
  Calculator,
  MapPin,
  Info,
} from 'lucide-react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import { SkeletonRows } from '../../components/LoadingSpinner'
import { PageHeader, ErrorState, Segmented, SearchInput, Avatar, Field, Meta } from '../../components/ui'
import { substitutionService } from '../../services/substitutionService'
import { facultyService } from '../../services/facultyService'
import { errorMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import useLoad from '../../lib/useLoad'
import useMediaQuery from '../../lib/useMediaQuery'
import { useChartTheme } from '../../lib/chartTheme'
import { asList, formatDate, formatDateLong, hhmm, relativeTime, isoDate } from '../../lib/format'

const GROUPS = {
  needs: ['PENDING', 'RECOMMENDED'],
  covered: ['APPROVED', 'ASSIGNED'],
  rejected: ['REJECTED'],
  suspended: ['SUSPENDED'],
}

function groupForStatus(status) {
  const s = (status || '').toUpperCase()
  return Object.keys(GROUPS).find((g) => GROUPS[g].includes(s)) || 'all'
}

export default function Substitutions() {
  const [params, setParams] = useSearchParams()
  const toast = useToast()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const list = useLoad(() => substitutionService.getAll().then((d) => asList(d)), [], { initial: [] })
  const faculty = useLoad(() => facultyService.getAll().then((d) => asList(d)), [], { initial: [] })

  const [tab, setTab] = useState(() => (params.get('status') ? groupForStatus(params.get('status')) : 'needs'))
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(() => (params.get('id') ? Number(params.get('id')) : null))

  const counts = useMemo(() => {
    const c = { all: list.data.length }
    Object.entries(GROUPS).forEach(([g, sts]) => (c[g] = list.data.filter((s) => sts.includes(s.status)).length))
    return c
  }, [list.data])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.data
      .filter((s) => tab === 'all' || GROUPS[tab]?.includes(s.status))
      .filter(
        (s) =>
          !q ||
          [s.subject_name, s.subject_code, s.class_name, s.absent_faculty_name, s.recommended_faculty_name, s.assignment?.assigned_faculty_name]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        // Upcoming first (soonest), then past (most recent).
        const today = isoDate()
        const fa = a.date >= today, fb = b.date >= today
        if (fa !== fb) return fa ? -1 : 1
        const cmp = (a.date || '').localeCompare(b.date || '') || (a.start_time || '').localeCompare(b.start_time || '')
        return fa ? cmp : -cmp
      })
  }, [list.data, tab, query])

  // A deep link (?id=) to a request in another tab switches to that tab once, on first load.
  const [linkReady, setLinkReady] = useState(false)
  useEffect(() => {
    if (linkReady || list.loading) return
    setLinkReady(true)
    const s = list.data.find((x) => x.id === selectedId)
    if (s && tab !== 'all' && !GROUPS[tab]?.includes(s.status)) setTab(groupForStatus(s.status))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.loading])

  // Desktop keeps a request open in the detail column.
  useEffect(() => {
    if (isDesktop && linkReady && !list.loading && filtered.length && !filtered.some((s) => s.id === selectedId)) setSelectedId(filtered[0].id)
  }, [isDesktop, filtered, selectedId, list.loading, linkReady])

  const select = (id) => {
    setSelectedId(id)
    const next = new URLSearchParams(params)
    next.set('id', id)
    next.delete('status')
    setParams(next, { replace: true })
  }

  const selected = list.data.find((s) => s.id === selectedId) || null

  const detail = selected && (
    <RequestDetail
      key={selected.id}
      request={selected}
      faculty={faculty.data}
      onChanged={() => list.reload()}
      toast={toast}
    />
  )

  return (
    <div>
      <PageHeader
        title="Substitutions"
        description="Each absence becomes a request per affected class. The allocation rules rank eligible colleagues; you approve, reassign or suspend."
        actions={
          <button type="button" onClick={list.reload} className="btn-secondary" disabled={list.loading}>
            <RefreshCw className={`w-4 h-4 ${list.loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="flex flex-col xl:flex-row xl:items-center gap-3 mb-5">
        <Segmented
          label="Request status"
          value={tab}
          onChange={setTab}
          options={[
            { id: 'needs', label: 'Needs decision', count: counts.needs },
            { id: 'covered', label: 'Covered', count: counts.covered },
            { id: 'rejected', label: 'Rejected', count: counts.rejected },
            { id: 'suspended', label: 'Suspended', count: counts.suspended },
            { id: 'all', label: 'All', count: counts.all },
          ]}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="Search subject, class or faculty" className="xl:ml-auto xl:w-80" />
      </div>

      {list.error ? (
        <div className="sheet">
          <ErrorState message={list.error} onRetry={list.reload} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(300px,5fr)_7fr] items-start">
          <section className="sheet overflow-hidden" aria-label="Requests">
            {list.loading ? (
              <div className="p-5">
                <SkeletonRows rows={5} />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={ArrowLeftRight}
                title={tab === 'needs' ? 'No requests waiting' : 'No requests here'}
                description={
                  tab === 'needs'
                    ? 'New requests appear when an absence is reported for a faculty member with classes that day.'
                    : 'Try another status or clear the search.'
                }
                action={
                  tab === 'needs' ? (
                    <Link to="/admin/absences" className="btn-primary btn-sm">
                      Report an absence
                    </Link>
                  ) : null
                }
              />
            ) : (
              <ul className="divide-y divide-line max-h-[calc(100dvh-260px)] lg:overflow-y-auto">
                {filtered.map((s) => {
                  const active = s.id === selectedId
                  const who = s.assignment?.assigned_faculty_name || s.recommended_faculty_name
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => select(s.id)}
                        aria-current={active ? 'true' : undefined}
                        className={`w-full text-left flex gap-3 px-4 py-3.5 transition-colors ${active ? 'bg-accent-soft/60' : 'hover:bg-surface-2'}`}
                      >
                        <div className="w-12 shrink-0 text-center rounded-md border border-line bg-surface py-1">
                          <p className="text-2xs text-ink-2 leading-tight">{formatDate(s.date, { month: 'short' })}</p>
                          <p className="font-heading font-black text-lg leading-tight text-ink tabular">{formatDate(s.date, { day: 'numeric' })}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-ink truncate">{s.subject_name}</p>
                            <Badge status={s.status} />
                          </div>
                          <p className="text-sm text-ink-2 truncate">
                            {hhmm(s.start_time)}–{hhmm(s.end_time)}, {s.class_name}
                            {s.section ? ` (${s.section})` : ''}
                          </p>
                          <p className="text-xs text-ink-3 truncate mt-0.5">
                            {s.absent_faculty_name} absent{who ? ` → ${who}` : ''}
                          </p>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {isDesktop && (
            <section className="sticky top-0" aria-label="Request detail">
              {detail || (
                <div className="sheet">
                  <EmptyState icon={ArrowLeftRight} title="Select a request" description="Its ranking, eligibility and actions appear here." />
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {!isDesktop && (
        <Modal isOpen={!!selected} onClose={() => setSelectedId(null)} title={selected?.subject_name || 'Request'} maxWidth="max-w-2xl">
          {selected && <RequestDetail key={selected.id} request={selected} faculty={faculty.data} onChanged={() => list.reload()} toast={toast} bare />}
        </Modal>
      )}
    </div>
  )
}

const WEIGHTS = [
  { key: 'subject_expertise', label: 'Qualified for subject', max: 50 },
  { key: 'department_match', label: 'Same department', max: 20 },
  { key: 'specialization', label: 'Relevant specialization', max: 10 },
  { key: 'workload', label: 'Lighter cover load', max: 20 },
]

function RequestDetail({ request: s, faculty, onChanged, toast, bare = false }) {
  const c = useChartTheme()
  const [busy, setBusy] = useState('')
  const [confirm, setConfirm] = useState(null) // 'reject' | 'suspend'
  const [assignOpen, setAssignOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const candidates = Array.isArray(s.all_candidates) ? s.all_candidates : []
  const status = (s.status || '').toUpperCase()
  const covered = ['APPROVED', 'ASSIGNED'].includes(status)
  const coverName = s.assignment?.assigned_faculty_name || s.recommended_faculty_name

  const run = async (kind, fn, okMsg) => {
    setBusy(kind)
    try {
      await fn()
      toast.success(okMsg)
      setConfirm(null)
      onChanged()
    } catch (err) {
      toast.error(errorMessage(err, 'The action could not be completed.'))
    } finally {
      setBusy('')
    }
  }

  const body = (
    <div className="space-y-6">
      {/* Class facts */}
      <div>
        {!bare && (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-heading font-extrabold text-xl text-ink">{s.subject_name}</h2>
              <p className="text-sm text-ink-2">{s.subject_code}</p>
            </div>
            <Badge status={status} />
          </div>
        )}
        {bare && <Badge status={status} />}
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <Meta label="Date">{formatDateLong(s.date)}</Meta>
          <Meta label="Time">
            {hhmm(s.start_time)}–{hhmm(s.end_time)}
          </Meta>
          <Meta label="Class">
            {s.class_name}
            {s.section ? `, section ${s.section}` : ''}
          </Meta>
          <Meta label="Room">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-ink-3" />
              {s.classroom || 'Not set'}
            </span>
          </Meta>
        </dl>
        <div className="mt-4 flex items-center gap-3 panel px-3.5 py-3">
          <Avatar name={s.absent_faculty_name} size="sm" />
          <p className="text-sm text-ink-2">
            <span className="font-semibold text-ink">{s.absent_faculty_name}</span> is absent
            {s.absent_faculty_department ? ` (${s.absent_faculty_department})` : ''}.
          </p>
        </div>
      </div>

      {/* Decision */}
      <div className={`rounded-panel border p-4 ${covered ? 'border-ok/80 bg-ok-soft' : status === 'PENDING' ? 'border-danger/30 bg-danger-soft' : 'border-line bg-surface-2'}`}>
        {covered ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-ok-ink shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-ink">
                  {coverName} is covering this class
                  {status === 'ASSIGNED' ? ' (assigned manually)' : ''}.
                </p>
                <p className="text-sm text-ink-2">
                  {s.assignment?.assigned_by_name ? `Approved by ${s.assignment.assigned_by_name}` : 'Approved'}
                  {s.assignment?.assigned_at ? ` ${relativeTime(s.assignment.assigned_at)}` : ''}.{' '}
                  {s.assignment?.is_acknowledged ? (
                    <span className="text-ok-ink font-semibold">Acknowledged {relativeTime(s.assignment.acknowledged_at)}.</span>
                  ) : (
                    <span className="text-warn-ink font-semibold">Waiting for {coverName?.split(' ').slice(-1)[0] || 'them'} to acknowledge.</span>
                  )}
                </p>
                {s.assignment?.notes && <p className="text-sm text-ink-2 mt-1">Note: {s.assignment.notes}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/admin/lesson-plan/${s.id}`} className="btn-primary btn-sm">
                <BookOpen className="w-4 h-4" />
                Open lesson plan
              </Link>
              <button type="button" onClick={() => setAssignOpen(true)} className="btn-secondary btn-sm">
                <UserCheck className="w-4 h-4" />
                Reassign
              </button>
              <button type="button" onClick={() => setConfirm('suspend')} className="btn-ghost btn-sm">
                <PauseCircle className="w-4 h-4" />
                Suspend class
              </button>
            </div>
          </div>
        ) : status === 'RECOMMENDED' && s.recommended_faculty_id ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar name={s.recommended_faculty_name} size="lg" />
              <div>
                <p className="text-sm text-ink-2">Top-ranked substitute</p>
                <p className="font-heading font-extrabold text-lg text-ink">{s.recommended_faculty_name}</p>
              </div>
              {typeof s.recommendation_score === 'number' && (
                <div className="ml-auto text-right">
                  <p className="font-heading font-black text-2xl text-ink tabular leading-none">{Math.round(s.recommendation_score)}</p>
                  <p className="text-xs text-ink-2">of 100</p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!!busy} onClick={() => run('approve', () => substitutionService.approve(s.id), `Approved ${s.recommended_faculty_name}. A lesson plan and notifications are being prepared.`)} className="btn-primary btn-sm">
                {busy === 'approve' ? <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Check className="w-4 h-4" />}
                Approve
              </button>
              <button type="button" disabled={!!busy} onClick={() => setAssignOpen(true)} className="btn-secondary btn-sm">
                <UserCheck className="w-4 h-4" />
                Assign someone else
              </button>
              <button type="button" disabled={!!busy} onClick={() => setConfirm('reject')} className="btn-ghost btn-sm">
                <X className="w-4 h-4" />
                Reject
              </button>
              <button type="button" disabled={!!busy} onClick={() => setConfirm('suspend')} className="btn-ghost btn-sm">
                <PauseCircle className="w-4 h-4" />
                Suspend class
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="font-semibold text-ink">
              {status === 'PENDING'
                ? 'No eligible substitute was found for this slot.'
                : status === 'REJECTED'
                ? 'The recommendation was rejected. This class has no cover yet.'
                : status === 'SUSPENDED'
                ? 'This class session is suspended.'
                : 'No decision recorded.'}
            </p>
            <p className="text-sm text-ink-2">Re-run the ranking after attendance changes, or assign a colleague directly. SYNCORA re-checks eligibility either way.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!!busy} onClick={() => run('recalc', () => substitutionService.recalculate(s.id), 'Ranking recalculated from current attendance and timetable.')} className="btn-secondary btn-sm">
                <RefreshCw className={`w-4 h-4 ${busy === 'recalc' ? 'animate-spin' : ''}`} />
                Re-run ranking
              </button>
              <button type="button" disabled={!!busy} onClick={() => setAssignOpen(true)} className="btn-primary btn-sm">
                <UserCheck className="w-4 h-4" />
                Assign a colleague
              </button>
              {status !== 'SUSPENDED' && (
                <button type="button" disabled={!!busy} onClick={() => setConfirm('suspend')} className="btn-ghost btn-sm">
                  <PauseCircle className="w-4 h-4" />
                  Suspend class
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ranking */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="font-heading font-bold text-md text-ink flex items-center gap-2">
            <Calculator className="w-4 h-4 text-ink-3" />
            Candidate ranking
          </h3>
          <span className="text-xs text-ink-2">{candidates.length} eligible</span>
        </div>
        <p className="text-sm text-ink-2 mb-3">
          Calculated by SYNCORA's allocation rules from attendance, timetable conflicts and cover history. Only colleagues who are present, free and not already covering are listed.
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2 mb-3" aria-label="Score components">
          {WEIGHTS.map((w, i) => (
            <li key={w.key} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c.series[i] }} aria-hidden="true" />
              {w.label} (up to {w.max})
            </li>
          ))}
        </ul>
        {candidates.length === 0 ? (
          <div className="panel p-4 text-sm text-ink-2 flex gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            Nobody met the eligibility checks when this request was ranked.
          </div>
        ) : (
          <ol className="space-y-2">
            {(showAll ? candidates : candidates.slice(0, 5)).map((cand, i) => {
              const isTop = cand.faculty_id === s.recommended_faculty_id
              return (
                <li key={cand.faculty_id} className={`rounded-panel border p-3.5 ${isTop ? 'border-accent/40 bg-accent-soft/40' : 'border-line bg-surface'}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-heading font-black text-ink-3 tabular">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink truncate">
                        {cand.faculty_name}
                        {isTop && <span className={`${covered ? 'chip-ok' : 'chip-info'} ml-2 align-middle`}>{covered ? 'Assigned' : 'Recommended'}</span>}
                      </p>
                      <p className="text-xs text-ink-2 truncate">
                        {[cand.designation, cand.department_name].filter(Boolean).join(', ')}
                      </p>
                    </div>
                    <span className="font-heading font-black text-lg text-ink tabular">{cand.score}</span>
                  </div>
                  <div className="mt-2.5 ml-9 flex h-2 gap-[2px]" role="img" aria-label={`Score ${cand.score} of 100`}>
                    {WEIGHTS.map((w, wi) => {
                      const v = cand.breakdown?.[w.key] || 0
                      return v > 0 ? <span key={w.key} className="h-full first:rounded-l-sm last:rounded-r-sm" style={{ width: `${v}%`, background: c.series[wi] }} title={`${w.label}: ${v}`} /> : null
                    })}
                    <span className="h-full flex-1 rounded-r-sm bg-surface-3" />
                  </div>
                  {cand.reasons?.length > 0 && (
                    <ul className="mt-2 ml-9 flex flex-wrap gap-1.5">
                      {cand.reasons.map((r) => (
                        <li key={r} className="chip-neutral font-medium">
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!cand.teaches_subject && <p className="mt-1.5 ml-9 text-xs text-warn-ink">Available, but not listed as qualified for this subject.</p>}
                </li>
              )
            })}
          </ol>
        )}
        {candidates.length > 5 && (
          <button type="button" className="mt-2 text-sm font-semibold text-accent-ink hover:underline" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            {showAll ? 'Show the top 5 only' : `Show all ${candidates.length} eligible colleagues`}
          </button>
        )}
      </div>

      {s.ai_explanation && (
        <div className="ground-ai rounded-panel p-4">
          <p className="text-xs font-semibold text-info-ink flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Generated summary
          </p>
          <p className="text-sm text-ink leading-relaxed">{s.ai_explanation}</p>
          <p className="text-xs text-ink-2 mt-2">Written from the ranking above (AI-assisted when the gateway is online). It explains; it does not decide.</p>
        </div>
      )}

      <p className="text-xs text-ink-3 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" />
        Request #{s.id}, created {relativeTime(s.created_at)}
      </p>

      <ConfirmDialog
        isOpen={confirm === 'reject'}
        onClose={() => setConfirm(null)}
        loading={busy === 'reject'}
        isDestructive
        title="Reject this recommendation?"
        confirmText="Reject recommendation"
        message={`${s.recommended_faculty_name || 'The recommended colleague'} will be told they are no longer needed. The class stays without cover until you assign someone.`}
        onConfirm={() => run('reject', () => substitutionService.reject(s.id), 'Recommendation rejected.')}
      />
      <ConfirmDialog
        isOpen={confirm === 'suspend'}
        onClose={() => setConfirm(null)}
        loading={busy === 'suspend'}
        isDestructive
        title="Suspend this class session?"
        confirmText="Suspend class"
        message={`${s.subject_name} for ${s.class_name} on ${formatDate(s.date)} will be marked as not taking place.`}
        onConfirm={() => run('suspend', () => substitutionService.suspend(s.id), 'Class session suspended.')}
      />
      <ManualAssign
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        request={s}
        faculty={faculty}
        candidates={candidates}
        onDone={() => {
          setAssignOpen(false)
          onChanged()
        }}
        toast={toast}
      />
    </div>
  )

  if (bare) return body
  return <div className="sheet p-5 sm:p-6">{body}</div>
}

function ManualAssign({ isOpen, onClose, request, faculty, candidates, onDone, toast }) {
  const [facultyId, setFacultyId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setFacultyId(candidates[0]?.faculty_id ? String(candidates[0].faculty_id) : '')
      setNotes('')
      setError('')
    }
  }, [isOpen, candidates])

  const eligibleIds = new Set(candidates.map((c) => c.faculty_id))
  const others = faculty.filter((f) => f.is_active !== false && f.id !== request.absent_faculty_id && !eligibleIds.has(f.id))

  const submit = async (e) => {
    e.preventDefault()
    if (!facultyId) return setError('Choose a colleague to assign.')
    setSaving(true)
    setError('')
    try {
      await substitutionService.manualAssign(request.id, { faculty_id: Number(facultyId), notes: notes.trim() || undefined })
      const name = faculty.find((f) => String(f.id) === String(facultyId))?.name
      toast.success(`${name || 'Colleague'} assigned to ${request.subject_name}.`)
      onDone()
    } catch (err) {
      setError(errorMessage(err, 'This colleague could not be assigned.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={saving}
      title="Assign a colleague"
      subtitle={`${request.subject_name}, ${request.class_name} on ${formatDate(request.date)} at ${hhmm(request.start_time)}`}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" form="assign-form" disabled={saving} className="btn-primary">
            {saving ? 'Assigning…' : 'Assign colleague'}
          </button>
        </>
      }
    >
      <form id="assign-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="rounded-panel bg-danger-soft border border-danger/30 p-3 text-sm text-ink" role="alert">
            {error}
          </div>
        )}
        <Field label="Colleague" htmlFor="assign-fac" hint="SYNCORA checks attendance, timetable clashes and other cover before saving.">
          <select id="assign-fac" className="input" value={facultyId} onChange={(e) => setFacultyId(e.target.value)} required>
            <option value="">Choose a colleague</option>
            {candidates.length > 0 && (
              <optgroup label="Eligible when ranked">
                {candidates.map((c) => (
                  <option key={c.faculty_id} value={c.faculty_id}>
                    {c.faculty_name} — score {c.score}
                  </option>
                ))}
              </optgroup>
            )}
            {others.length > 0 && (
              <optgroup label="Other faculty (may not be eligible)">
                {others.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.department_name || 'No department'})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>
        <Field label="Note for the record" htmlFor="assign-notes" hint="Optional. Saved with the assignment.">
          <textarea id="assign-notes" rows={3} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="For example: requested by the head of department" />
        </Field>
      </form>
    </Modal>
  )
}

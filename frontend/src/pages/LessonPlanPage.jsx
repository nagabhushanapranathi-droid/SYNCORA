import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Printer,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  CircleDashed,
  HelpCircle,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Target,
  ListChecks,
  Lightbulb,
  Users,
  ClipboardCheck,
  NotebookPen,
  Package,
  MessagesSquare,
  BookMarked,
  FileText,
  ChevronDown,
  Clock,
  Lock,
} from 'lucide-react'
import Badge from '../components/Badge'
import Markdown from '../components/Markdown'
import Mascot from '../components/Mascot'
import { Skeleton } from '../components/LoadingSpinner'
import { ErrorState, Field, Meta, Segmented } from '../components/ui'
import { substitutionService } from '../services/substitutionService'
import { errorMessage } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useChartTheme } from '../lib/chartTheme'
import { formatDateLong, formatDate, hhmm, relativeTime } from '../lib/format'

const PLAN_STATUS = {
  GENERATED: 'Ready to read',
  VIEWED: 'Read by the substitute',
  IN_PROGRESS: 'Class under way',
  COMPLETED: 'Class taught',
}

export default function LessonPlanPage() {
  const { requestId } = useParams()
  const id = Number(requestId)
  const { user } = useAuth()
  const toast = useToast()
  const isAdmin = user?.role === 'admin'
  const back = isAdmin ? { to: `/admin/substitutions?id=${id}`, label: 'Back to substitutions' } : { to: '/faculty/substitutions', label: 'Back to cover duties' }

  const [plan, setPlan] = useState(null)
  const [planState, setPlanState] = useState('loading') // loading | ready | missing | forbidden | error
  const [planError, setPlanError] = useState('')
  const [context, setContext] = useState(null)
  const [request, setRequest] = useState(null)
  const [generating, setGenerating] = useState(false)

  const loadPlan = async () => {
    setPlanState('loading')
    try {
      const p = await substitutionService.getLessonPlan(id)
      setPlan(p)
      setPlanState('ready')
    } catch (err) {
      const st = err.response?.status
      if (st === 404) setPlanState('missing')
      else if (st === 403) setPlanState('forbidden')
      else {
        setPlanError(errorMessage(err, 'The lesson plan could not be loaded.'))
        setPlanState('error')
      }
    }
  }
  const loadContext = () =>
    substitutionService
      .getAcademicContext(id)
      .then(setContext)
      .catch(() => setContext(null))

  useEffect(() => {
    loadPlan()
    loadContext()
    substitutionService.getById(id).then(setRequest).catch(() => setRequest(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const myFacultyId = user?.faculty_id
  const isSubstitute = plan ? myFacultyId === plan.substitute_faculty_id : request?.assignment?.assigned_faculty_id === myFacultyId
  const isOriginal = plan ? myFacultyId === plan.original_faculty_id : request?.absent_faculty_id === myFacultyId
  const canGenerate = isAdmin || (myFacultyId && (request?.assignment?.assigned_faculty_id || request?.recommended_faculty_id) === myFacultyId)
  const canEdit = isAdmin || isSubstitute || isOriginal

  const generate = async () => {
    setGenerating(true)
    try {
      const p = await substitutionService.generateLessonPlan(id, true)
      setPlan(p)
      setPlanState('ready')
      toast.success(p.is_ai_generated ? 'Lesson plan generated through the AI gateway.' : 'Lesson plan built from the syllabus rules (AI gateway unavailable).')
      loadContext()
    } catch (err) {
      toast.error(errorMessage(err, 'The lesson plan could not be generated.'))
    } finally {
      setGenerating(false)
    }
  }

  // Live context first; the snapshot stored with the plan is the fallback.
  const ctx = context || plan?.academic_context || null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <Link to={back.to} className="btn-ghost btn-sm -ml-2">
          <ArrowLeft className="w-4 h-4" />
          {back.label}
        </Link>
        {planState === 'ready' && (
          <div className="flex flex-wrap gap-2">
            {canGenerate && (
              <button type="button" className="btn-ghost btn-sm" onClick={generate} disabled={generating}>
                <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                {generating ? 'Regenerating…' : 'Regenerate'}
              </button>
            )}
            <button type="button" className="btn-secondary btn-sm" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" />
              Print plan
            </button>
          </div>
        )}
      </div>

      {planState === 'loading' ? (
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      ) : planState === 'forbidden' ? (
        <div className="sheet p-10 text-center">
          <Lock className="w-8 h-8 text-ink-3 mx-auto" />
          <p className="font-heading font-bold text-lg text-ink mt-3">This lesson plan is private</p>
          <p className="text-sm text-ink-2 mt-1">Only the substitute, the faculty member being covered and administrators can open it.</p>
        </div>
      ) : planState === 'error' ? (
        <div className="sheet">
          <ErrorState message={planError} onRetry={loadPlan} />
        </div>
      ) : planState === 'missing' ? (
        <div className="sheet p-8 sm:p-12 text-center">
          <Mascot size={84} mood="thinking" className="mx-auto" />
          <h1 className="font-heading font-extrabold text-xl text-ink mt-4">No lesson plan yet</h1>
          <p className="text-sm text-ink-2 max-w-md mx-auto mt-1">
            {request && !['APPROVED', 'ASSIGNED'].includes(request.status)
              ? 'Plans are prepared once a substitute is approved for this class.'
              : 'A plan is normally prepared when cover is approved. You can create it now from the syllabus and recorded progress.'}
          </p>
          {canGenerate && (
            <button type="button" className="btn-primary mt-5" onClick={generate} disabled={generating}>
              <Sparkles className="w-4 h-4" />
              {generating ? 'Preparing the plan…' : 'Prepare lesson plan'}
            </button>
          )}
          {ctx && (
            <div className="text-left mt-8">
              <Continuity ctx={ctx} />
            </div>
          )}
        </div>
      ) : (
        <>
          <PlanHeader plan={plan} ctx={ctx} request={request} />
          {plan.has_academic_continuity_warning && (
            <div className="ground-unverified rounded-panel p-4 flex gap-3" role="note">
              <AlertTriangle className="w-5 h-5 text-warn-ink shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-ink">Provisional plan: class progress is not verified</p>
                <p className="text-sm text-ink-2 mt-0.5">{plan.continuity_warning_message}</p>
              </div>
            </div>
          )}
          {ctx && <Continuity ctx={ctx} live={!!context} />}
          <PlanBody plan={plan} />
          {canEdit && (
            <AfterClass
              plan={plan}
              ctx={ctx}
              requestId={id}
              isAdmin={isAdmin}
              isSubstitute={isSubstitute}
              isOriginal={isOriginal}
              onPlanUpdated={setPlan}
              onContextChanged={loadContext}
            />
          )}
        </>
      )}
    </div>
  )
}

function PlanHeader({ plan, ctx, request }) {
  const sp = plan.structured_plan || {}
  const cls = ctx?.class_details || {}
  return (
    <header className="sheet-feature p-5 sm:p-7 pt-7">
      <div className="flex flex-wrap items-center gap-2">
        <Badge status={plan.status} label={PLAN_STATUS[plan.status] || plan.status} />
        {plan.is_ai_generated ? (
          <span className="chip ground-ai text-info-ink whitespace-normal">
            <Sparkles className="w-3 h-3" />
            AI-generated via {plan.ai_provider}
            {plan.ai_model ? ` (${plan.ai_model})` : ''}
          </span>
        ) : (
          <span className="chip ground-calc text-ink-2 whitespace-normal">
            <Calculator className="w-3 h-3" />
            Built from syllabus rules ({plan.ai_provider || 'offline'})
          </span>
        )}
        {request?.assignment && (
          <span className={request.assignment.is_acknowledged ? 'chip-ok' : 'chip-warn'}>{request.assignment.is_acknowledged ? 'Duty acknowledged' : 'Duty not yet acknowledged'}</span>
        )}
      </div>
      <h1 className="font-heading font-black text-2xl sm:text-3xl text-ink mt-3 leading-tight">{sp.lesson_title || `${plan.subject_name} cover lesson`}</h1>
      <p className="text-base text-ink-2 mt-1">
        {plan.subject_name} ({plan.subject_code}) for {plan.class_name}
        {plan.section ? `, section ${plan.section}` : ''}
      </p>
      <dl className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
        <Meta label="Date">{formatDateLong(plan.scheduled_date)}</Meta>
        <Meta label="Time">
          {cls.start_time ? `${hhmm(cls.start_time)}–${hhmm(cls.end_time)}, ` : ''}
          {plan.duration_minutes} min
        </Meta>
        <Meta label="Room">{cls.classroom || 'Not set'}</Meta>
        <Meta label="Department">{ctx?.subject?.department || '—'}</Meta>
        <Meta label="Semester">
          <span className="text-ink-3 font-normal" title="SYNCORA does not record semesters">
            Not recorded
          </span>
        </Meta>
        <Meta label="Prepared">{relativeTime(plan.updated_at || plan.created_at)}</Meta>
      </dl>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="panel px-4 py-3">
          <p className="text-xs text-ink-2">Usually taught by</p>
          <p className="font-semibold text-ink">{plan.original_faculty_name}</p>
        </div>
        <div className="panel px-4 py-3">
          <p className="text-xs text-ink-2">Covered by</p>
          <p className="font-semibold text-ink">{plan.substitute_faculty_name}</p>
        </div>
      </div>
      <p className="mt-4 text-xs text-ink-3 flex gap-1.5">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        This plan is preparation. The class counts as taught only once progress is recorded below.
      </p>
    </header>
  )
}

function Continuity({ ctx, live = true }) {
  const ac = ctx?.academic_continuity || {}
  const [showSyllabus, setShowSyllabus] = useState(false)
  const verified = ac.verified_completed_topics || []
  const progress = ac.in_progress_topics || []
  const unverified = ac.unverified_records || []
  const suggestedIsAI = /ai/i.test(ac.topic_source || '')
  const ho = ac.handover_note

  return (
    <section className="space-y-4" aria-labelledby="cont-h">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="cont-h" className="font-heading font-extrabold text-xl text-ink">
            Where the class is
          </h2>
          <p className="text-sm text-ink-2">
            {ctx.class_details?.class_name} in {ctx.subject?.name}. {live ? 'Live from progress records.' : 'Snapshot saved with the plan.'}
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ContinuityCard kind="verified" title="Verified as taught" icon={ShieldCheck} empty="No lessons have been recorded as taught for this class yet.">
          {verified.map((t) => (
            <li key={t.id}>
              <p className="font-semibold text-ink">{t.topic_name}</p>
              <p className="text-xs text-ink-2">
                {t.unit_number ? `Unit ${t.unit_number}, ` : ''}
                {t.faculty_name}
                {t.completion_date ? `, ${formatDate(t.completion_date, { day: 'numeric', month: 'short' })}` : ''}
              </p>
            </li>
          ))}
        </ContinuityCard>
        <ContinuityCard kind="progress" title="Recorded as in progress" icon={CircleDashed} empty="No topic is marked as part-way through.">
          {progress.map((t) => (
            <li key={t.id}>
              <p className="font-semibold text-ink">{t.topic_name}</p>
              <p className="text-xs text-ink-2">
                {t.unit_number ? `Unit ${t.unit_number}, ` : ''}
                {t.faculty_name}
              </p>
            </li>
          ))}
        </ContinuityCard>
        <ContinuityCard kind={suggestedIsAI ? 'ai' : 'calc'} title="Suggested next" icon={suggestedIsAI ? Sparkles : Calculator} empty="No suggestion available.">
          {(ac.target_topics || []).map((t) => (
            <li key={t}>
              <p className="font-semibold text-ink">{t}</p>
            </li>
          ))}
          {ac.target_unit && <li className="text-xs text-ink-2">{ac.target_unit}</li>}
          {ac.topic_source && <li className="text-xs text-ink-3">Source: {ac.topic_source}</li>}
        </ContinuityCard>
        <ContinuityCard kind="unverified" title="Unverified information" icon={HelpCircle} empty="Nothing unverified on file.">
          {unverified.map((t) => (
            <li key={t.id}>
              <p className="font-semibold text-ink">{t.topic_name}</p>
              <p className="text-xs text-ink-2">Recorded by {t.faculty_name}, not confirmed</p>
            </li>
          ))}
        </ContinuityCard>
      </div>

      <div className="sheet p-5">
        <h3 className="font-heading font-bold text-ink flex items-center gap-2">
          <FileText className="w-4 h-4 text-ink-3" />
          Handover from {ctx.faculty?.original_faculty_name}
        </h3>
        {ho ? (
          <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <Meta label="Current unit">{ho.current_unit || '—'}</Meta>
            <Meta label="Stopped at">{ho.current_topic || '—'}</Meta>
            <Meta label="Pending assignments">{ho.pending_assignments || '—'}</Meta>
            <Meta label="Completed topics">{ho.completed_topics?.length ? ho.completed_topics.join(', ') : '—'}</Meta>
            <Meta label="Next topics">{ho.next_topics?.length ? ho.next_topics.join(', ') : '—'}</Meta>
            <Meta label="Notes about students">{ho.student_notes || '—'}</Meta>
            {ho.additional_instructions && (
              <Meta label="Other instructions" className="sm:col-span-2 lg:col-span-3">
                {ho.additional_instructions}
              </Meta>
            )}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-warn-ink font-medium">No handover note has been written. Ask {ctx.faculty?.original_faculty_name || 'the faculty member'} where the class stopped.</p>
        )}
      </div>

      {(ac.syllabus_units || []).length > 0 && (
        <div className="sheet">
          <button type="button" className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left" onClick={() => setShowSyllabus((s) => !s)} aria-expanded={showSyllabus}>
            <span className="font-heading font-bold text-ink flex items-center gap-2">
              <BookMarked className="w-4 h-4 text-ink-3" />
              Official syllabus ({ac.syllabus_units.length} units)
            </span>
            <ChevronDown className={`w-4 h-4 text-ink-3 transition-transform ${showSyllabus ? 'rotate-180' : ''}`} />
          </button>
          {showSyllabus && (
            <ol className="px-5 pb-5 space-y-3">
              {ac.syllabus_units.map((u) => (
                <li key={u.id} className="panel p-3.5">
                  <p className="font-semibold text-ink">
                    Unit {u.unit_number}: {u.unit_title}
                  </p>
                  <p className="text-sm text-ink-2 mt-0.5">{(u.topics || []).join(', ')}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}

const CARD_KIND = {
  verified: 'ground-verified',
  progress: 'border border-line-strong bg-surface',
  ai: 'ground-ai',
  calc: 'ground-calc',
  unverified: 'ground-unverified',
}
const CARD_INK = { verified: 'text-ok-ink', progress: 'text-ink-2', ai: 'text-info-ink', calc: 'text-ink-2', unverified: 'text-warn-ink' }

function ContinuityCard({ kind, title, icon: Icon, empty, children }) {
  const items = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean)
  return (
    <div className={`rounded-panel p-4 ${CARD_KIND[kind]}`}>
      <p className={`text-sm font-bold flex items-center gap-1.5 ${CARD_INK[kind]}`}>
        <Icon className="w-4 h-4" />
        {title}
      </p>
      {items.length ? <ul className="mt-2.5 space-y-2 text-sm">{items}</ul> : <p className="mt-2.5 text-sm text-ink-2">{empty}</p>}
    </div>
  )
}

/** Build the visual schedule from the backend's teaching_sequence or time_allocation. */
function useTimeline(sp, duration) {
  return useMemo(() => {
    const seq = Array.isArray(sp?.teaching_sequence) ? sp.teaching_sequence : []
    const parsed = seq.map((s) => {
      const m = String(s).match(/(\d+)\s*[-–]\s*(\d+)\s*min/i)
      return m ? { from: Number(m[1]), to: Number(m[2]), text: String(s).replace(/^[^:]*\(\s*\d+\s*[-–]\s*\d+\s*min\s*\)\s*:?\s*/i, '').trim() || String(s), raw: String(s) } : null
    })
    if (seq.length && parsed.every(Boolean)) {
      return { source: 'sequence', segments: parsed.map((p) => ({ label: p.text, from: p.from, to: p.to, minutes: p.to - p.from })) }
    }
    const alloc = sp?.time_allocation && typeof sp.time_allocation === 'object' ? sp.time_allocation : null
    if (alloc) {
      let t = 0
      const segments = Object.entries(alloc)
        .filter(([k, v]) => !/total/i.test(k) && Number(v) > 0)
        .map(([k, v]) => {
          const minutes = Number(v)
          const seg = { label: k.replace(/_minutes?$/i, '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), from: t, to: t + minutes, minutes }
          t += minutes
          return seg
        })
      return { source: 'allocation', segments }
    }
    return { source: 'none', segments: [] }
  }, [sp, duration])
}

function Timeline({ sp, duration }) {
  const c = useChartTheme()
  const { segments } = useTimeline(sp, duration)
  if (!segments.length) return null
  const total = segments.reduce((a, s) => a + s.minutes, 0)
  const span = Math.max(total, duration || 0) || 1
  const fits = duration ? total === duration : true
  const palette = [c.series[0], c.series[1], c.series[2], c.series[3]]
  return (
    <div>
      <div className="flex h-9 gap-[2px] rounded-md overflow-hidden" role="img" aria-label={`Teaching schedule totalling ${total} of ${duration} minutes`}>
        {segments.map((s, i) => (
          <div key={i} className="h-full flex items-center justify-center text-[11px] font-semibold text-white/95 tabular" style={{ width: `${(s.minutes / span) * 100}%`, background: palette[i % palette.length] }} title={`${s.label}: ${s.minutes} min`}>
            {(s.minutes / span) * 100 > 9 ? `${s.minutes}′` : ''}
          </div>
        ))}
        {total < span && <div className="h-full flex-1 bg-surface-3" title="Unallocated time" />}
      </div>
      <table className="w-full mt-4 text-sm">
        <thead className="sr-only">
          <tr>
            <th>Time</th>
            <th>Activity</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((s, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              <td className="py-2 pr-4 align-top whitespace-nowrap">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: palette[i % palette.length] }} aria-hidden="true" />
                  <span className="font-semibold text-ink tabular">
                    {s.from}–{s.to} min
                  </span>
                </span>
              </td>
              <td className="py-2 text-ink-2">{s.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`mt-3 text-sm font-medium flex items-center gap-1.5 ${fits ? 'text-ok-ink' : 'text-warn-ink'}`}>
        {fits ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        {fits ? `Fits the ${duration}-minute class exactly.` : `Adds up to ${total} of the ${duration} scheduled minutes — adjust on the day.`}
      </p>
    </div>
  )
}

function PlanSection({ icon: Icon, title, items, ordered = false, quote = false }) {
  if (!items || (Array.isArray(items) && !items.length)) return null
  const list = Array.isArray(items) ? items : [items]
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <section className="break-inside-avoid">
      <h3 className="font-heading font-bold text-md text-ink flex items-center gap-2 mb-2.5">
        <Icon className="w-4 h-4 text-ink-3" />
        {title}
      </h3>
      <Tag className={`space-y-2 text-base text-ink ${ordered ? 'list-decimal pl-5 marker:text-ink-3 marker:font-semibold' : ''}`}>
        {list.map((it, i) => (
          <li key={i} className={ordered ? 'pl-1' : 'flex gap-2.5'}>
            {!ordered && <span className="mt-2 w-1.5 h-1.5 rounded-full bg-brand shrink-0" aria-hidden="true" />}
            <span className={quote ? 'italic text-ink' : ''}>{String(it)}</span>
          </li>
        ))}
      </Tag>
    </section>
  )
}

function PlanBody({ plan }) {
  const sp = plan.structured_plan
  if (!sp) {
    return (
      <section className="sheet p-5 sm:p-7">
        <Markdown text={plan.lesson_content} />
      </section>
    )
  }
  const completed = new Set(plan.topics_completed || [])
  return (
    <section className="sheet p-5 sm:p-7 space-y-8" aria-labelledby="plan-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="plan-h" className="font-heading font-extrabold text-xl text-ink">
          The lesson
        </h2>
        {plan.is_ai_generated ? (
          <span className="chip ground-ai text-info-ink whitespace-normal">
            <Sparkles className="w-3 h-3" />
            AI-generated content, review before class
          </span>
        ) : (
          <span className="chip ground-calc text-ink-2 whitespace-normal">
            <Calculator className="w-3 h-3" />
            Template from the syllabus rules, review before class
          </span>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <PlanSection icon={Target} title="Learning objectives" items={sp.learning_objectives} />
        <section>
          <h3 className="font-heading font-bold text-md text-ink flex items-center gap-2 mb-2.5">
            <ListChecks className="w-4 h-4 text-ink-3" />
            Topics to cover
          </h3>
          <ul className="space-y-2">
            {(sp.topics_to_cover || []).map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-base text-ink">
                {completed.has(t) ? <CheckCircle2 className="w-4 h-4 text-ok-ink mt-0.5 shrink-0" /> : <CircleDashed className="w-4 h-4 text-ink-3 mt-0.5 shrink-0" />}
                <span>
                  {t}
                  {completed.has(t) && <span className="ml-2 chip-ok">Marked taught</span>}
                </span>
              </li>
            ))}
          </ul>
          {(sp.prerequisites || []).length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-ink-2 mb-1.5">Students should already know</p>
              <ul className="space-y-1 text-sm text-ink-2 list-disc pl-5">
                {sp.prerequisites.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <section>
        <h3 className="font-heading font-bold text-md text-ink flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-ink-3" />
          Teaching schedule ({plan.duration_minutes} minutes)
        </h3>
        <Timeline sp={sp} duration={plan.duration_minutes} />
      </section>

      <PlanSection icon={ListChecks} title="Teaching sequence" items={sp.teaching_sequence} ordered />

      <div className="grid gap-8 lg:grid-cols-2">
        <PlanSection icon={Lightbulb} title="Examples and explanations" items={sp.examples_and_explanations} />
        <PlanSection icon={Users} title="Classroom activities" items={sp.classroom_activities} />
        <PlanSection icon={MessagesSquare} title="Questions to ask the class" items={sp.student_engagement_questions} quote />
        <PlanSection icon={ClipboardCheck} title="Check for understanding" items={sp.assessment_questions} ordered />
        <PlanSection icon={NotebookPen} title="Homework" items={sp.homework} />
        <PlanSection icon={Package} title="Bring to class" items={sp.required_materials} />
      </div>

      {(plan.teaching_notes || plan.feedback) && (
        <div className="grid gap-4 sm:grid-cols-2 rule pt-6">
          {plan.teaching_notes && (
            <div>
              <p className="text-sm font-semibold text-ink">Notes after class</p>
              <p className="text-sm text-ink-2 whitespace-pre-line mt-1">{plan.teaching_notes}</p>
            </div>
          )}
          {plan.feedback && (
            <div>
              <p className="text-sm font-semibold text-ink">Feedback</p>
              <p className="text-sm text-ink-2 whitespace-pre-line mt-1">{plan.feedback}</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function AfterClass({ plan, ctx, requestId, isAdmin, isSubstitute, isOriginal, onPlanUpdated, onContextChanged }) {
  const toast = useToast()
  const [tab, setTab] = useState(isOriginal && !isSubstitute ? 'handover' : 'record')
  const sp = plan.structured_plan || {}
  const topics = sp.topics_to_cover || []

  // Record progress
  const [rec, setRec] = useState({ topic: topics[0] || '', custom: '', unit: '', hours: String(Math.round(((plan.duration_minutes || 60) / 60) * 10) / 10), status: 'COMPLETED', notes: '' })
  // Notes & feedback
  const [notes, setNotes] = useState({ status: plan.status || 'GENERATED', teaching_notes: plan.teaching_notes || '', feedback: plan.feedback || '' })
  // Handover
  const ho = ctx?.academic_continuity?.handover_note
  const [hand, setHand] = useState({
    current_unit: ho?.current_unit || '',
    current_topic: ho?.current_topic || '',
    completed_topics: (ho?.completed_topics || []).join('\n'),
    next_topics: (ho?.next_topics || []).join('\n'),
    pending_assignments: ho?.pending_assignments || '',
    student_notes: ho?.student_notes || '',
    additional_instructions: ho?.additional_instructions || '',
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setNotes({ status: plan.status || 'GENERATED', teaching_notes: plan.teaching_notes || '', feedback: plan.feedback || '' })
  }, [plan.status, plan.teaching_notes, plan.feedback])

  const submitRecord = async (e) => {
    e.preventDefault()
    const topic = rec.topic === '__custom' ? rec.custom.trim() : rec.topic
    if (!topic) return toast.error('Name the topic you taught.')
    const hours = Number(rec.hours)
    if (!(hours > 0 && hours <= 8)) return toast.error('Hours must be between 0 and 8.')
    setBusy(true)
    try {
      await substitutionService.recordProgress(requestId, {
        topic_name: topic,
        unit_number: rec.unit ? Number(rec.unit) : undefined,
        hours_spent: hours,
        notes: rec.notes.trim() || undefined,
        status: rec.status,
      })
      if (rec.status === 'COMPLETED' && topics.includes(topic)) {
        const done = [...new Set([...(plan.topics_completed || []), topic])]
        const updated = await substitutionService.updateLessonPlan(requestId, { topics_completed: done })
        onPlanUpdated(updated)
      }
      toast.success(rec.status === 'COMPLETED' ? `"${topic}" recorded as taught.` : `"${topic}" recorded as partly covered.`)
      setRec((r) => ({ ...r, notes: '', custom: '' }))
      onContextChanged()
    } catch (err) {
      toast.error(errorMessage(err, 'Progress could not be recorded.'))
    } finally {
      setBusy(false)
    }
  }

  const submitNotes = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const updated = await substitutionService.updateLessonPlan(requestId, notes)
      onPlanUpdated(updated)
      toast.success('Notes and status saved.')
    } catch (err) {
      toast.error(errorMessage(err, 'Notes could not be saved.'))
    } finally {
      setBusy(false)
    }
  }

  const submitHandover = async (e) => {
    e.preventDefault()
    const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean)
    setBusy(true)
    try {
      await substitutionService.submitHandover(requestId, {
        current_unit: hand.current_unit.trim(),
        current_topic: hand.current_topic.trim(),
        completed_topics: lines(hand.completed_topics),
        next_topics: lines(hand.next_topics),
        pending_assignments: hand.pending_assignments.trim(),
        student_notes: hand.student_notes.trim(),
        additional_instructions: hand.additional_instructions.trim(),
      })
      toast.success('Handover note saved.')
      onContextChanged()
    } catch (err) {
      toast.error(errorMessage(err, 'The handover note could not be saved.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="sheet p-5 sm:p-6 no-print" aria-labelledby="after-h">
      <h2 id="after-h" className="font-heading font-extrabold text-xl text-ink">
        After the class
      </h2>
      <p className="text-sm text-ink-2 mt-0.5 mb-4">
        {isAdmin ? 'Record progress on behalf of the substitute, or update notes.' : isSubstitute ? 'Tell the department what actually happened so the next lesson continues correctly.' : 'Leave guidance for whoever covers your class.'}
      </p>
      <Segmented
        label="After-class actions"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'record', label: 'Record what was taught' },
          { id: 'notes', label: 'Notes and status' },
          { id: 'handover', label: 'Handover note' },
        ]}
        className="mb-5"
      />

      {tab === 'record' && (
        <form onSubmit={submitRecord} className="space-y-4 max-w-2xl">
          <p className="text-sm text-ink-2 panel p-3">Recorded progress becomes the verified history for {plan.class_name}. Only record topics that were actually taught.</p>
          <Field label="Topic" htmlFor="rec-topic">
            <select id="rec-topic" className="input" value={rec.topic} onChange={(e) => setRec({ ...rec, topic: e.target.value })}>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                  {(plan.topics_completed || []).includes(t) ? ' (already marked taught)' : ''}
                </option>
              ))}
              <option value="__custom">Something else…</option>
            </select>
          </Field>
          {rec.topic === '__custom' && (
            <Field label="Topic taught" htmlFor="rec-custom">
              <input id="rec-custom" className="input" value={rec.custom} onChange={(e) => setRec({ ...rec, custom: e.target.value })} maxLength={255} />
            </Field>
          )}
          <Field label="How far did you get?">
            <div className="grid grid-cols-2 gap-2 max-w-md" role="radiogroup" aria-label="Coverage">
              {[
                ['COMPLETED', 'Fully taught'],
                ['IN_PROGRESS', 'Partly covered'],
              ].map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={rec.status === v} onClick={() => setRec({ ...rec, status: v })} className={`h-10 rounded-ctl border text-sm font-semibold ${rec.status === v ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-strong text-ink-2 hover:text-ink'}`}>
                  {l}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <Field label="Syllabus unit" htmlFor="rec-unit" hint="Optional">
              <input id="rec-unit" type="number" min={1} className="input" value={rec.unit} onChange={(e) => setRec({ ...rec, unit: e.target.value })} />
            </Field>
            <Field label="Hours spent" htmlFor="rec-hours">
              <input id="rec-hours" type="number" step="0.25" min={0.25} max={8} className="input" value={rec.hours} onChange={(e) => setRec({ ...rec, hours: e.target.value })} />
            </Field>
          </div>
          <Field label="What happened" htmlFor="rec-notes" hint="Problems worked, questions raised, anything left unfinished.">
            <textarea id="rec-notes" rows={3} className="input" value={rec.notes} onChange={(e) => setRec({ ...rec, notes: e.target.value })} />
          </Field>
          <button type="submit" className="btn-primary" disabled={busy}>
            <ShieldCheck className="w-4 h-4" />
            {busy ? 'Recording…' : 'Record progress'}
          </button>
        </form>
      )}

      {tab === 'notes' && (
        <form onSubmit={submitNotes} className="space-y-4 max-w-2xl">
          <Field label="Status" htmlFor="pl-status" hint="Mark the class as taught only after it took place.">
            <select id="pl-status" className="input max-w-xs" value={notes.status} onChange={(e) => setNotes({ ...notes, status: e.target.value })}>
              {Object.entries(PLAN_STATUS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes after class" htmlFor="pl-notes">
            <textarea id="pl-notes" rows={4} className="input" value={notes.teaching_notes} onChange={(e) => setNotes({ ...notes, teaching_notes: e.target.value })} placeholder="Pace, what landed, what to revisit" />
          </Field>
          <Field label="Feedback for the department" htmlFor="pl-fb">
            <textarea id="pl-fb" rows={3} className="input" value={notes.feedback} onChange={(e) => setNotes({ ...notes, feedback: e.target.value })} />
          </Field>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save notes'}
          </button>
        </form>
      )}

      {tab === 'handover' && (
        <form onSubmit={submitHandover} className="space-y-4">
          <p className="text-sm text-ink-2 panel p-3 max-w-3xl">
            {isSubstitute && !isOriginal
              ? `Hand the class back to ${plan.original_faculty_name}: where you stopped and what comes next.`
              : 'Where your class stopped, so the substitute continues from the right place.'}
            {ho ? ` Last updated ${relativeTime(ho.updated_at || ho.created_at)}.` : ''}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Current unit" htmlFor="ho-unit">
              <input id="ho-unit" className="input" value={hand.current_unit} onChange={(e) => setHand({ ...hand, current_unit: e.target.value })} placeholder="Unit 2: Linked lists" />
            </Field>
            <Field label="Stopped at" htmlFor="ho-topic">
              <input id="ho-topic" className="input" value={hand.current_topic} onChange={(e) => setHand({ ...hand, current_topic: e.target.value })} placeholder="Doubly linked list insertion" />
            </Field>
            <Field label="Completed topics" htmlFor="ho-done" hint="One per line">
              <textarea id="ho-done" rows={3} className="input" value={hand.completed_topics} onChange={(e) => setHand({ ...hand, completed_topics: e.target.value })} />
            </Field>
            <Field label="Next topics" htmlFor="ho-next" hint="One per line">
              <textarea id="ho-next" rows={3} className="input" value={hand.next_topics} onChange={(e) => setHand({ ...hand, next_topics: e.target.value })} />
            </Field>
            <Field label="Pending assignments" htmlFor="ho-pend">
              <textarea id="ho-pend" rows={2} className="input" value={hand.pending_assignments} onChange={(e) => setHand({ ...hand, pending_assignments: e.target.value })} />
            </Field>
            <Field label="Notes about students" htmlFor="ho-stu">
              <textarea id="ho-stu" rows={2} className="input" value={hand.student_notes} onChange={(e) => setHand({ ...hand, student_notes: e.target.value })} />
            </Field>
          </div>
          <Field label="Other instructions" htmlFor="ho-add">
            <textarea id="ho-add" rows={2} className="input" value={hand.additional_instructions} onChange={(e) => setHand({ ...hand, additional_instructions: e.target.value })} />
          </Field>
          <button type="submit" className="btn-primary" disabled={busy}>
            <FileText className="w-4 h-4" />
            {busy ? 'Saving…' : 'Save handover note'}
          </button>
        </form>
      )}
    </section>
  )
}

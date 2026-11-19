import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Send, Copy, Check, RotateCcw, ShieldCheck, Sparkles, Calculator, HelpCircle, ChevronDown, AlertTriangle } from 'lucide-react'
import Mascot from '../components/Mascot'
import Markdown from '../components/Markdown'
import { SignatureMotif, Sparkle } from '../components/motifs'
import { aiService } from '../services/aiService'
import { errorMessage } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useChartTheme, ChartTooltip } from '../lib/chartTheme'
import { formatClock, formatDate } from '../lib/format'

// Prompts phrased to reach the backend's grounding tools (see build_chat_context).
const PROMPTS = {
  admin: [
    { group: 'Today', items: ['Who is absent today?', "Show today's substitution requests", 'What are the attendance stats today?'] },
    { group: 'Planning', items: ['Which faculty have the heaviest substitution workload?', 'Which lesson plans are pending?', 'Which substitutions are missing handover notes?'] },
    { group: 'Teaching', items: ['Suggest the next syllabus topic to continue', 'Suggest an engaging activity for a 60-minute data structures class'] },
  ],
  faculty: [
    { group: 'My classes', items: ['What am I teaching on my next day of classes?', 'Show my assigned lesson plan', 'What did the class cover previously?'] },
    { group: 'Today', items: ['Who is present today?', 'What are the attendance stats today?'] },
    { group: 'Teaching help', items: ['Suggest a five-minute warm-up for my next class', 'Explain recursion with a classroom-friendly example'] },
  ],
}

// How each grounding source returned by /api/ai/chat is labelled.
const SOURCES = {
  my_teaching_schedule: ['Your teaching schedule', 'verified'],
  my_assigned_plans: ['Your assigned lesson plans', 'verified'],
  previous_lecture_progress: ['Recorded lecture progress', 'verified'],
  pending_lesson_plans: ['Cover classes without a lesson plan', 'verified'],
  missing_handover_notes: ['Cover classes without handover notes', 'verified'],
  present_faculty: ['Faculty checked in today', 'verified'],
  absent_faculty: ['Absences today', 'verified'],
  today_substitutions: ["Today's substitution requests", 'verified'],
  attendance_summary: ['Attendance summary', 'calc'],
  substitution_workloads: ['Cover workload by faculty', 'calc'],
  suggested_next_topics: ['Next-topic suggestion from the syllabus', 'calc'],
}
const BASE_KEYS = ['current_date', 'current_time', 'total_active_faculty', 'user_role', 'faculty_id']

const KIND = {
  verified: { cls: 'ground-verified text-ok-ink', icon: ShieldCheck, label: 'Institutional record' },
  calc: { cls: 'ground-calc text-ink-2', icon: Calculator, label: 'Calculated by SYNCORA' },
  ai: { cls: 'ground-ai text-info-ink', icon: Sparkles, label: 'AI-written' },
  unverified: { cls: 'ground-unverified text-warn-ink', icon: HelpCircle, label: 'Unverified' },
}

const now = () => new Date().toISOString()
const FALLBACK_MARK = '### SYNCORA Academic Assistant (Grounded Mode)'

export default function AssistantPage() {
  const { user } = useAuth()
  const role = user?.role === 'admin' ? 'admin' : 'faculty'
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const send = async (text) => {
    const msg = (text ?? input).trim()
    if (!msg || sending) return
    setInput('')
    const userMsg = { id: `u${Date.now()}`, role: 'user', text: msg, at: now() }
    setMessages((m) => [...m, userMsg])
    setSending(true)
    try {
      const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))
      const res = await aiService.chat(msg, history)
      const reply = String(res?.reply || '')
      setMessages((m) => [
        ...m,
        {
          id: `a${Date.now()}`,
          role: 'assistant',
          text: reply.replace(FALLBACK_MARK, '').trim(),
          ruleBased: reply.startsWith(FALLBACK_MARK),
          context: res?.context || {},
          at: now(),
        },
      ])
    } catch (err) {
      setMessages((m) => [...m, { id: `e${Date.now()}`, role: 'assistant', error: true, text: errorMessage(err, 'Cora could not reach the SYNCORA server.'), retry: msg, at: now() }])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const retry = (m) => {
    setMessages((list) => list.filter((x) => x.id !== m.id))
    send(m.retry)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:h-[calc(100dvh-8rem)]">
      {/* Cora's desk */}
      <aside className="flex flex-col gap-4 lg:overflow-y-auto lg:pr-1" aria-label="About Cora">
        <div className="sheet-feature p-5 pt-6 shrink-0">
          <div className="flex items-center gap-3">
            <Mascot size={72} mood={sending ? 'thinking' : 'idle'} />
            <div>
              <h1 className="font-heading font-black text-2xl text-ink">Cora</h1>
              <p className="text-sm text-ink-2">SYNCORA's assistant</p>
            </div>
          </div>
          <p className="text-sm text-ink-2 mt-3">
            {role === 'admin'
              ? 'Ask about attendance, absences, cover, workload and lesson plans across the institution. Cora reads the live records before answering.'
              : 'Ask about your classes, your cover duties and lesson plans, or for teaching ideas. Cora only sees records you are allowed to see.'}
          </p>
          <div className="mt-4 space-y-1.5" aria-label="Answer labels">
            {['verified', 'calc', 'ai'].map((k) => {
              const K = KIND[k]
              return (
                <p key={k} className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold ${K.cls}`}>
                  <K.icon className="w-3.5 h-3.5" />
                  {K.label}
                </p>
              )
            })}
          </div>
        </div>

        <div className="sheet p-4 shrink-0">
          <p className="font-heading font-bold text-ink mb-2">Try asking</p>
          <div className="space-y-3">
            {PROMPTS[role].map((g) => (
              <div key={g.group}>
                <p className="text-xs font-semibold text-ink-3 mb-1.5">{g.group}</p>
                <ul className="space-y-1.5">
                  {g.items.map((p) => (
                    <li key={p}>
                      <button
                        type="button"
                        onClick={() => send(p)}
                        disabled={sending}
                        className="w-full text-left text-sm text-ink rounded-panel border border-line bg-surface hover:border-accent/50 hover:bg-accent-soft/40 px-3 py-2 transition-colors disabled:opacity-50"
                      >
                        {p}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Conversation */}
      <section className="sheet flex flex-col min-h-[70dvh] lg:min-h-0 overflow-hidden order-first lg:order-none" aria-label="Conversation with Cora">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line">
          <p className="text-sm text-ink-2 flex items-center gap-2">
            <span className="text-brand">
              <SignatureMotif className="w-5 h-4" />
            </span>
            {role === 'admin' ? 'Institution-wide records' : 'Your records only'}
          </p>
          {messages.length > 0 && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => setMessages([])} disabled={sending}>
              <RotateCcw className="w-3.5 h-3.5" />
              New conversation
            </button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6" aria-live="polite">
          {messages.length === 0 && !sending && (
            <div className="h-full flex flex-col items-center justify-center text-center py-10">
              <div className="relative">
                <Mascot size={110} mood="happy" />
                <Sparkle className="absolute -top-1 -right-3 w-5 h-5 text-warn dark:text-info" />
              </div>
              <p className="font-heading font-extrabold text-xl text-ink mt-4">What would you like to know?</p>
              <p className="text-sm text-ink-2 mt-1 max-w-md">Pick a suggested question or write your own. Answers show which records they came from.</p>
              <ul className="lg:hidden mt-5 w-full max-w-sm space-y-1.5">
                {PROMPTS[role].flatMap((g) => g.items).slice(0, 4).map((p) => (
                  <li key={p}>
                    <button type="button" onClick={() => send(p)} className="w-full text-left text-sm text-ink rounded-panel border border-line bg-surface hover:border-accent/50 px-3 py-2">
                      {p}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {messages.map((m) => (m.role === 'user' ? <UserBubble key={m.id} m={m} /> : <CoraBubble key={m.id} m={m} onRetry={() => retry(m)} />))}

          {sending && (
            <div className="flex items-end gap-3">
              <Mascot size={40} mood="thinking" />
              <div className="rounded-sheet rounded-bl-md border border-line bg-surface-2 px-4 py-3 flex items-center gap-2">
                <span className="flex gap-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-ink-3 animate-dot" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
                <span className="text-sm text-ink-2">Cora is checking the records…</span>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="border-t border-line p-3 sm:p-4 bg-surface-2/50"
        >
          <div className="flex items-end gap-2 rounded-panel border border-line-strong bg-surface p-1.5 focus-within:border-accent focus-within:shadow-focus transition-shadow">
            <label htmlFor="cora-input" className="sr-only">
              Message Cora
            </label>
            <textarea
              id="cora-input"
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={1000}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Ask Cora about schedules, cover, attendance or lesson plans"
              className="flex-1 resize-none bg-transparent px-2.5 py-2 text-base text-ink placeholder:text-ink-3 focus:outline-none"
            />
            <button type="submit" className="btn-primary h-10 w-10 !px-0 shrink-0" disabled={sending || !input.trim()} aria-label="Send message">
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-ink-3 mt-1.5 px-1">Enter to send, Shift+Enter for a new line. Cora suggests; decisions stay with people.</p>
        </form>
      </section>
    </div>
  )
}

function UserBubble({ m }) {
  return (
    <div className="flex justify-end animate-fade-up">
      <div className="max-w-[min(85%,560px)]">
        <div className="rounded-sheet rounded-br-md bg-accent-soft border border-accent/20 px-4 py-2.5 text-base text-ink whitespace-pre-wrap">{m.text}</div>
        <p className="text-xs text-ink-3 mt-1 text-right">{formatClock(m.at)}</p>
      </div>
    </div>
  )
}

function CoraBubble({ m, onRetry }) {
  const [copied, setCopied] = useState(false)
  const sources = useMemo(() => Object.keys(m.context || {}).filter((k) => !BASE_KEYS.includes(k) && SOURCES[k]), [m.context])
  const hasUnverified = (m.context?.previous_lecture_progress || []).some?.((p) => p.is_verified === false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(m.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked */
    }
  }

  if (m.error) {
    return (
      <div className="flex items-start gap-3 animate-fade-up">
        <Mascot size={40} mood="worried" />
        <div className="rounded-sheet rounded-tl-md border border-danger/30 bg-danger-soft px-4 py-3 max-w-[min(90%,640px)]" role="alert">
          <p className="text-sm font-semibold text-ink flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-danger-ink" />
            No answer this time
          </p>
          <p className="text-sm text-ink-2 mt-0.5">{m.text}</p>
          <button type="button" className="btn-secondary btn-sm mt-2.5" onClick={onRetry}>
            <RotateCcw className="w-3.5 h-3.5" />
            Ask again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 animate-fade-up">
      <Mascot size={40} mood="idle" className="shrink-0" />
      <div className="min-w-0 flex-1 max-w-[760px]">
        <div className="relative rounded-sheet rounded-tl-md border border-line bg-surface px-4 sm:px-5 py-4 shadow-sheet">
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {m.ruleBased ? (
              <span className="chip ground-calc text-ink-2 whitespace-normal">
                <Calculator className="w-3 h-3" />
                Rule-based answer (AI gateway offline)
              </span>
            ) : (
              <span className="chip ground-ai text-info-ink whitespace-normal">
                <Sparkles className="w-3 h-3" />
                {sources.length ? 'AI-written from the records below' : 'AI-written suggestion, no institutional records used'}
              </span>
            )}
            {hasUnverified && (
              <span className="chip ground-unverified text-warn-ink whitespace-normal">
                <HelpCircle className="w-3 h-3" />
                Includes unverified progress
              </span>
            )}
          </div>
          <Markdown text={m.text} />
          <button type="button" onClick={copy} className="btn-icon absolute top-2 right-2 w-8 h-8" aria-label="Copy answer">
            {copied ? <Check className="w-4 h-4 text-ok-ink" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        {sources.length > 0 && <Grounding context={m.context} sources={sources} />}
        <p className="text-xs text-ink-3 mt-1.5">
          {formatClock(m.at)}
          {m.context?.current_date ? `, records as of ${formatDate(m.context.current_date)}` : ''}
        </p>
      </div>
    </div>
  )
}

function Grounding({ context, sources }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex flex-wrap items-center gap-1.5 text-left" aria-expanded={open}>
        <span className="text-xs font-semibold text-ink-2 mr-0.5">Based on</span>
        {sources.map((k) => {
          const [label, kind] = SOURCES[k]
          const K = KIND[kind]
          return (
            <span key={k} className={`chip ${K.cls}`}>
              <K.icon className="w-3 h-3" />
              {label}
            </span>
          )
        })}
        <ChevronDown className={`w-4 h-4 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-3 animate-fade-up">
          {sources.map((k) => (
            <div key={k} className="rounded-panel border border-line bg-surface-2/60 p-3">
              <p className="text-xs font-semibold text-ink-2 mb-2">{SOURCES[k][0]}</p>
              <SourceView k={k} value={context[k]} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SourceView({ k, value }) {
  const c = useChartTheme()
  if (k === 'substitution_workloads' && Array.isArray(value) && value.length) {
    const data = value.slice(0, 8).map((v) => ({ name: v.name, count: v.substitutions_conducted }))
    return (
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
            <CartesianGrid {...c.gridProps} horizontal={false} vertical />
            <XAxis type="number" allowDecimals={false} {...c.axisProps} />
            <YAxis type="category" dataKey="name" {...c.axisProps} width={120} tickFormatter={(v) => (v.length > 17 ? `${v.slice(0, 16)}…` : v)} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: c.cursor }} />
            <Bar dataKey="count" name="Approved cover duties" fill={c.series[0]} radius={[0, 4, 4, 0]} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }
  if (k === 'my_teaching_schedule' && value && typeof value === 'object') {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-ink-2">
          {value.day_of_week}, {formatDate(value.date)}
        </p>
        <RecordTable rows={(value.regular_classes || []).map((r) => ({ time: `${r.start_time}–${r.end_time}`, subject: r.subject_name, class: r.class_name, room: r.classroom }))} empty="No regular classes." />
        {(value.substitution_classes || []).length > 0 && <RecordTable rows={value.substitution_classes.map((s) => ({ cover: s.subject, class: s.class_name, time: `${s.start_time}–${s.end_time}`, plan: s.has_lesson_plan ? 'Ready' : 'Pending' }))} />}
      </div>
    )
  }
  if (Array.isArray(value)) {
    if (!value.length) return <p className="text-sm text-ink-2">No matching records.</p>
    return <RecordTable rows={value.map(flatten)} />
  }
  if (value && typeof value === 'object') {
    return (
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
        {Object.entries(flatten(value)).map(([kk, v]) => (
          <div key={kk}>
            <dt className="text-xs text-ink-2">{humanize(kk)}</dt>
            <dd className="font-semibold text-ink break-words">{String(v ?? '—')}</dd>
          </div>
        ))}
      </dl>
    )
  }
  return <p className="text-sm text-ink">{String(value)}</p>
}

function RecordTable({ rows, empty = 'No records.' }) {
  const [all, setAll] = useState(false)
  if (!rows.length) return <p className="text-sm text-ink-2">{empty}</p>
  const cols = Object.keys(rows[0]).filter((c) => !/(^id$|_id$|structured_plan|academic_context|lesson_content)/.test(c)).slice(0, 6)
  const shown = all ? rows : rows.slice(0, 6)
  return (
    <div>
      <div className="overflow-x-auto rounded-md border border-line bg-surface relative">
        <table className="w-full text-xs">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c} className="text-left font-semibold text-ink-2 px-2.5 py-1.5 border-b border-line bg-surface-2 whitespace-nowrap">
                  {humanize(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c} className="px-2.5 py-1.5 border-b border-line last:border-b-0 text-ink align-top">
                    {String(r[c] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 6 && (
        <button type="button" className="mt-1 text-xs font-semibold text-accent-ink hover:underline" onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  )
}

function flatten(obj) {
  const out = {}
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) out[k] = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v
    else if (Array.isArray(v)) out[k] = v.every((x) => typeof x !== 'object') ? v.join(', ') : `${v.length} items`
  })
  return out
}

function humanize(k) {
  return k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

import { useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Printer, Sparkles, RefreshCw, Calculator, BookOpenCheck, Cpu, ShieldCheck } from 'lucide-react'
import ChartCard from '../../components/ChartCard'
import Markdown from '../../components/Markdown'
import { Skeleton } from '../../components/LoadingSpinner'
import { PageHeader, Field, Segmented, ErrorState } from '../../components/ui'
import { reportService } from '../../services/reportService'
import { substitutionService } from '../../services/substitutionService'
import { attendanceService } from '../../services/attendanceService'
import { absenceService } from '../../services/absenceService'
import { departmentService } from '../../services/departmentService'
import { subjectService } from '../../services/subjectService'
import { facultyService } from '../../services/facultyService'
import { aiService } from '../../services/aiService'
import { errorMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import useLoad from '../../lib/useLoad'
import { useChartTheme, ChartTooltip, ChartLegend } from '../../lib/chartTheme'
import { asList, isoDate, formatDate, formatDateLong } from '../../lib/format'

const PRESETS = [
  { id: '7', label: '7 days' },
  { id: '30', label: '30 days' },
  { id: '90', label: '90 days' },
]

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoDate(d)
}

export default function Reports() {
  const c = useChartTheme()
  const toast = useToast()
  const [preset, setPreset] = useState('30')
  const [start, setStart] = useState(daysAgo(29))
  const [end, setEnd] = useState(isoDate())
  const [dept, setDept] = useState('')
  const [subject, setSubject] = useState('')
  const [facultyId, setFacultyId] = useState('')

  const departments = useLoad(() => departmentService.getAll().then((d) => asList(d)), [], { initial: [] })
  const subjects = useLoad(() => subjectService.getAll().then((d) => asList(d)), [], { initial: [] })
  const faculty = useLoad(() => facultyService.getAll().then((d) => asList(d)), [], { initial: [] })
  const stats = useLoad(() => reportService.getStats(), [])
  const analytics = useLoad(
    () => reportService.getAnalytics({ start_date: start, end_date: end, ...(dept ? { department_id: dept } : {}) }),
    [start, end, dept]
  )
  const subs = useLoad(() => substitutionService.getAll().then((d) => asList(d)), [], { initial: [] })
  const absences = useLoad(() => absenceService.getAll().then((d) => asList(d)), [], { initial: [] })
  const today = useLoad(() => attendanceService.getToday(), [])

  const [report, setReport] = useState(null)
  const [reportBusy, setReportBusy] = useState(false)
  const [reportError, setReportError] = useState('')

  const applyPreset = (id) => {
    setPreset(id)
    setStart(daysAgo(Number(id) - 1))
    setEnd(isoDate())
  }

  const deptName = departments.data.find((d) => String(d.id) === dept)?.name
  const facName = faculty.data.find((f) => String(f.id) === facultyId)?.name

  // Substitution requests narrowed by every filter (client-side; the list endpoint has no range filter).
  const subsInRange = useMemo(
    () =>
      subs.data.filter(
        (s) =>
          s.date >= start &&
          s.date <= end &&
          (!dept || s.absent_faculty_department === deptName) &&
          (!subject || s.subject_code === subject) &&
          (!facultyId || String(s.absent_faculty_id) === facultyId || String(s.assignment?.assigned_faculty_id) === facultyId || String(s.recommended_faculty_id) === facultyId)
      ),
    [subs.data, start, end, dept, deptName, subject, facultyId]
  )
  const absencesInRange = absences.data.filter(
    (a) => a.date >= start && a.date <= end && (!dept || a.faculty_department === deptName) && (!facultyId || String(a.faculty_id) === facultyId)
  )

  const a = analytics.data
  const covered = subsInRange.filter((s) => ['APPROVED', 'ASSIGNED'].includes(s.status)).length
  const suspended = subsInRange.filter((s) => s.status === 'SUSPENDED').length
  const openCount = subsInRange.filter((s) => ['PENDING', 'RECOMMENDED'].includes(s.status)).length
  const recordedDays = (a?.daily_attendance || []).filter((d) => d.present + d.absent > 0)

  const daily = (a?.daily_attendance || []).map((d) => ({
    ...d,
    label: formatDate(d.date, { day: 'numeric', month: 'short' }),
    rate: d.present + d.absent > 0 ? d.attendance_rate : null,
  }))

  const monthly = useMemo(() => {
    const m = {}
    subsInRange.forEach((s) => {
      const k = s.date.slice(0, 7)
      m[k] = m[k] || { month: k, requests: 0, covered: 0 }
      m[k].requests++
      if (['APPROVED', 'ASSIGNED'].includes(s.status)) m[k].covered++
    })
    return Object.values(m)
      .sort((x, y) => x.month.localeCompare(y.month))
      .map((x) => ({ ...x, label: new Date(`${x.month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) }))
  }, [subsInRange])

  const bySubject = useMemo(() => {
    const m = {}
    subsInRange.forEach((s) => {
      const k = s.subject_name || s.subject_code
      m[k] = (m[k] || 0) + 1
    })
    return Object.entries(m)
      .map(([name, count]) => ({ name, count }))
      .sort((x, y) => y.count - x.count)
      .slice(0, 8)
  }, [subsInRange])

  const workload = (a?.workload_distribution || []).filter((w) => !facultyId || String(w.faculty_id) === facultyId).slice(0, 10)
  const deptCompare = (a?.department_comparison || []).map((d) => ({ ...d, short: d.code || d.department_name }))
  const classesByDept = (stats.data?.by_department || []).map((d) => ({ name: d.department_code || d.department_name, full: d.department_name, classes: d.active_classes, faculty: d.faculty_count }))
  const slots = a?.frequently_affected_slots || []

  const t = today.data
  const available = t?.present_count || 0
  const unavailable = t ? (t.absent_count || 0) + (t.logged_out_count || 0) + (t.not_marked_count || 0) : 0

  const generate = async () => {
    setReportBusy(true)
    setReportError('')
    try {
      const res = await aiService.generateReport()
      setReport(res)
      toast.success("Today's briefing is ready.")
    } catch (err) {
      setReportError(errorMessage(err, 'The briefing could not be generated.'))
    } finally {
      setReportBusy(false)
    }
  }

  const barProps = { radius: [4, 4, 0, 0], maxBarSize: 24 }
  const hBarProps = { radius: [0, 4, 4, 0], maxBarSize: 18 }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Attendance, cover and workload calculated from SYNCORA's records. Every figure links back to stored data."
        actions={
          <button type="button" className="btn-secondary no-print" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            Print report
          </button>
        }
      >
        <p className="print-only mt-2 text-sm">
          Range {formatDate(start)} to {formatDate(end)}
          {deptName ? `, ${deptName}` : ''}
          {subject ? `, ${subject}` : ''}
          {facName ? `, ${facName}` : ''}
        </p>
      </PageHeader>

      {/* Filters */}
      <section className="sheet p-4 no-print" aria-label="Report filters">
        <div className="flex flex-col xl:flex-row gap-4 xl:items-end">
          <div>
            <p className="field-label">Range</p>
            <Segmented label="Date range" value={preset} onChange={applyPreset} options={[...PRESETS, ...(preset === 'custom' ? [{ id: 'custom', label: 'Custom' }] : [])]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="r-start">
              <input id="r-start" type="date" className="input" value={start} max={end} onChange={(e) => { setStart(e.target.value); setPreset('custom') }} />
            </Field>
            <Field label="To" htmlFor="r-end">
              <input id="r-end" type="date" className="input" value={end} min={start} onChange={(e) => { setEnd(e.target.value); setPreset('custom') }} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            <Field label="Department" htmlFor="r-dept">
              <select id="r-dept" className="input" value={dept} onChange={(e) => setDept(e.target.value)}>
                <option value="">All departments</option>
                {departments.data.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Subject" htmlFor="r-subj">
              <select id="r-subj" className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">All subjects</option>
                {subjects.data.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Faculty" htmlFor="r-fac">
              <select id="r-fac" className="input" value={facultyId} onChange={(e) => setFacultyId(e.target.value)}>
                <option value="">All faculty</option>
                {faculty.data.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        <p className="text-xs text-ink-3 mt-3">Department applies to every chart. Subject and faculty narrow the substitution and workload charts.</p>
      </section>

      {/* Range summary */}
      <section className="sheet-feature px-2 py-5" aria-label="Range summary">
        <dl className="grid grid-cols-2 lg:grid-cols-5 gap-y-5">
          {[
            ['Attendance rate', analytics.loading ? null : recordedDays.length ? `${a.summary.average_rate}%` : 'No records', recordedDays.length ? `Across ${recordedDays.length} recorded days` : 'No check-ins in range'],
            ['Absences reported', absences.loading ? null : absencesInRange.length, 'In range'],
            ['Substitution requests', subs.loading ? null : subsInRange.length, `${openCount} still open`],
            ['Covered', subs.loading ? null : subsInRange.length ? `${Math.round((covered / subsInRange.length) * 100)}%` : '—', `${covered} of ${subsInRange.length} requests`],
            ['Suspended classes', subs.loading ? null : suspended, 'No cover arranged'],
          ].map(([label, value, note], i) => (
            <div key={label} className={`px-4 sm:px-5 ${i > 0 ? 'lg:rule-v' : ''}`}>
              <dt className="text-sm text-ink-2">{label}</dt>
              <dd className="mt-1">{value === null ? <Skeleton className="h-8 w-16" /> : <span className="font-heading font-black text-[1.9rem] leading-none text-ink tabular">{value}</span>}</dd>
              <dd className="mt-1.5 text-xs text-ink-3">{note}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Attendance */}
      <h2 className="font-heading font-extrabold text-xl text-ink pt-2">Attendance</h2>
      <div className="grid gap-6 lg:grid-cols-12">
        <ChartCard
          className="lg:col-span-8"
          title="Daily attendance"
          description="Faculty present and absent per day (days without check-ins show as zero)"
          loading={analytics.loading}
          error={analytics.error}
          onRetry={analytics.reload}
          empty={!daily.length}
          legend={<ChartLegend items={[{ label: 'Present', color: c.good }, { label: 'Absent', color: c.critical }]} />}
          table={{
            columns: [
              { key: 'date', label: 'Date' },
              { key: 'present', label: 'Present', align: 'right' },
              { key: 'absent', label: 'Absent', align: 'right' },
              { key: 'rateText', label: 'Rate', align: 'right' },
            ],
            rows: daily.map((d) => ({ date: formatDate(d.date), present: d.present, absent: d.absent, rateText: d.rate === null ? 'No records' : `${d.rate}%` })),
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid {...c.gridProps} />
              <XAxis dataKey="label" {...c.axisProps} minTickGap={24} />
              <YAxis allowDecimals={false} {...c.axisProps} width={40} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: c.grid }} />
              <Area type="linear" dataKey="present" name="Present" stroke={c.good} strokeWidth={2} fill={c.good} fillOpacity={0.1} />
              <Area type="linear" dataKey="absent" name="Absent" stroke={c.critical} strokeWidth={2} fill={c.critical} fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          className="lg:col-span-4"
          title="Present and absent"
          description="Check-in records in range"
          loading={analytics.loading}
          error={analytics.error}
          onRetry={analytics.reload}
          empty={!a || a.summary.total_present_range + a.summary.total_absent_range === 0}
          emptyText="No attendance was recorded in this range."
          table={{
            columns: [
              { key: 'name', label: 'Status' },
              { key: 'value', label: 'Records', align: 'right' },
            ],
            rows: a?.present_vs_absent || [],
          }}
        >
          {a && (
            <div className="relative h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={a.present_vs_absent} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" stroke={c.surface} strokeWidth={2} startAngle={90} endAngle={-270}>
                    {a.present_vs_absent.map((p) => (
                      <Cell key={p.name} fill={p.name === 'Present' ? c.good : c.critical} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-heading font-black text-2xl text-ink tabular">{a.summary.average_rate}%</span>
                <span className="text-xs text-ink-2">present</span>
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard
          className="lg:col-span-6"
          title="Attendance by department"
          description="Share of check-in records marked present (all recorded days)"
          loading={analytics.loading}
          error={analytics.error}
          onRetry={analytics.reload}
          empty={!deptCompare.length}
          table={{
            columns: [
              { key: 'department_name', label: 'Department' },
              { key: 'faculty_count', label: 'Faculty', align: 'right' },
              { key: 'attendance_rate', label: 'Rate %', align: 'right' },
            ],
            rows: deptCompare,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deptCompare} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid {...c.gridProps} horizontal={false} vertical />
              <XAxis type="number" domain={[0, 100]} unit="%" {...c.axisProps} />
              <YAxis type="category" dataKey="short" {...c.axisProps} width={56} />
              <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} labelFormatter={(l, p) => p?.[0]?.payload?.department_name} />} cursor={{ fill: c.cursor }} />
              <Bar dataKey="attendance_rate" name="Present" fill={c.good} {...hBarProps} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          className="lg:col-span-6"
          title="Available faculty today"
          description="Checked in and present versus absent, logged out or not marked"
          loading={today.loading}
          error={today.error}
          onRetry={today.reload}
          empty={!t || available + unavailable === 0}
          height="h-auto"
          table={{
            columns: [
              { key: 'k', label: 'Group' },
              { key: 'v', label: 'Faculty', align: 'right' },
            ],
            rows: t
              ? [
                  { k: 'Present', v: t.present_count },
                  { k: 'Absent', v: t.absent_count },
                  { k: 'Logged out', v: t.logged_out_count },
                  { k: 'Not marked', v: t.not_marked_count },
                ]
              : [],
          }}
        >
          {t && (
            <div className="pt-2">
              <div className="flex items-baseline gap-2">
                <span className="font-heading font-black text-3xl text-ink tabular">{available}</span>
                <span className="text-sm text-ink-2">of {available + unavailable} can be ranked for cover right now</span>
              </div>
              <div className="mt-4 flex h-4 gap-[2px]" role="img" aria-label={`${available} available, ${unavailable} unavailable`}>
                {[
                  [t.present_count, c.good, 'Present'],
                  [t.absent_count, c.critical, 'Absent'],
                  [t.logged_out_count, c.warning, 'Logged out'],
                  [t.not_marked_count, c.neutral, 'Not marked'],
                ]
                  .filter(([v]) => v > 0)
                  .map(([v, col, l]) => (
                    <span key={l} title={`${l}: ${v}`} className="h-full first:rounded-l last:rounded-r" style={{ flexGrow: v, background: col }} />
                  ))}
              </div>
              <ChartLegend
                items={[
                  { label: `Present ${t.present_count}`, color: c.good },
                  { label: `Absent ${t.absent_count}`, color: c.critical },
                  { label: `Logged out ${t.logged_out_count}`, color: c.warning },
                  { label: `Not marked ${t.not_marked_count}`, color: c.neutral },
                ]}
              />
            </div>
          )}
        </ChartCard>
      </div>

      {/* Substitutions & workload */}
      <h2 className="font-heading font-extrabold text-xl text-ink pt-2">Cover and workload</h2>
      <div className="grid gap-6 lg:grid-cols-12">
        <ChartCard
          className="lg:col-span-7"
          title="Faculty workload"
          description="Weekly timetabled hours plus approved cover duties (1 hour each), heaviest first"
          loading={analytics.loading}
          error={analytics.error}
          onRetry={analytics.reload}
          empty={!workload.length}
          height="h-80"
          legend={<ChartLegend items={[{ label: 'Timetabled hours', color: c.series[1] }, { label: 'Cover hours', color: c.series[0] }]} />}
          table={{
            columns: [
              { key: 'faculty_name', label: 'Faculty' },
              { key: 'regular_hours', label: 'Timetabled h', align: 'right' },
              { key: 'substitution_hours', label: 'Cover h', align: 'right' },
              { key: 'total_hours', label: 'Total h', align: 'right' },
            ],
            rows: workload,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={workload} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid {...c.gridProps} horizontal={false} vertical />
              <XAxis type="number" allowDecimals={false} {...c.axisProps} />
              <YAxis type="category" dataKey="faculty_name" {...c.axisProps} width={128} tickFormatter={(v) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: c.cursor }} />
              <Bar dataKey="regular_hours" name="Timetabled hours" stackId="h" fill={c.series[1]} maxBarSize={18} stroke={c.surface} strokeWidth={1} />
              <Bar dataKey="substitution_hours" name="Cover hours" stackId="h" fill={c.series[0]} {...hBarProps} stroke={c.surface} strokeWidth={1} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          className="lg:col-span-5"
          title="Requests by month"
          description="Substitution requests created, and how many were covered"
          loading={subs.loading}
          error={subs.error}
          onRetry={subs.reload}
          empty={!monthly.length}
          emptyText="No substitution requests in this range."
          height="h-80"
          legend={<ChartLegend items={[{ label: 'Requests', color: c.series[0] }, { label: 'Covered', color: c.series[2] }]} />}
          table={{
            columns: [
              { key: 'label', label: 'Month' },
              { key: 'requests', label: 'Requests', align: 'right' },
              { key: 'covered', label: 'Covered', align: 'right' },
            ],
            rows: monthly,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 12, left: -18, bottom: 0 }} barGap={2}>
              <CartesianGrid {...c.gridProps} />
              <XAxis dataKey="label" {...c.axisProps} />
              <YAxis allowDecimals={false} {...c.axisProps} width={40} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: c.cursor }} />
              <Bar dataKey="requests" name="Requests" fill={c.series[0]} {...barProps} />
              <Bar dataKey="covered" name="Covered" fill={c.series[2]} {...barProps} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          className="lg:col-span-6"
          title="Requests by subject"
          description="Which subjects needed cover most (top 8)"
          loading={subs.loading}
          error={subs.error}
          onRetry={subs.reload}
          empty={!bySubject.length}
          emptyText="No substitution requests match these filters."
          table={{
            columns: [
              { key: 'name', label: 'Subject' },
              { key: 'count', label: 'Requests', align: 'right' },
            ],
            rows: bySubject,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bySubject} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid {...c.gridProps} horizontal={false} vertical />
              <XAxis type="number" allowDecimals={false} {...c.axisProps} />
              <YAxis type="category" dataKey="name" {...c.axisProps} width={136} tickFormatter={(v) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: c.cursor }} />
              <Bar dataKey="count" name="Requests" fill={c.series[0]} {...hBarProps} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          className="lg:col-span-6"
          title="Most affected hours"
          description="Substitution requests by class slot in range"
          loading={analytics.loading}
          error={analytics.error}
          onRetry={analytics.reload}
          empty={!slots.length}
          emptyText="No classes needed cover in this range."
          table={{
            columns: [
              { key: 'hour', label: 'Slot' },
              { key: 'affected_count', label: 'Requests', align: 'right' },
            ],
            rows: slots,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={slots} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid {...c.gridProps} />
              <XAxis dataKey="hour" {...c.axisProps} tickFormatter={(v) => v.split(' - ')[0]} />
              <YAxis allowDecimals={false} {...c.axisProps} width={40} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: c.cursor }} />
              <Bar dataKey="affected_count" name="Requests" fill={c.series[1]} {...barProps} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          className="lg:col-span-12"
          title="Classes by department"
          description="Weekly timetabled classes per department (current template)"
          loading={stats.loading}
          error={stats.error}
          onRetry={stats.reload}
          empty={!classesByDept.length}
          height="h-56"
          table={{
            columns: [
              { key: 'full', label: 'Department' },
              { key: 'classes', label: 'Classes a week', align: 'right' },
              { key: 'faculty', label: 'Faculty', align: 'right' },
            ],
            rows: classesByDept,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={classesByDept} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid {...c.gridProps} />
              <XAxis dataKey="name" {...c.axisProps} />
              <YAxis allowDecimals={false} {...c.axisProps} width={40} />
              <Tooltip content={<ChartTooltip labelFormatter={(l, p) => p?.[0]?.payload?.full} />} cursor={{ fill: c.cursor }} />
              <Bar dataKey="classes" name="Classes a week" fill={c.series[2]} {...barProps} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Continuity + AI telemetry */}
      <h2 className="font-heading font-extrabold text-xl text-ink pt-2">Academic continuity</h2>
      <section className="sheet p-5" aria-label="Academic continuity">
        {analytics.loading ? (
          <Skeleton className="h-24" />
        ) : analytics.error ? (
          <ErrorState compact message={analytics.error} onRetry={analytics.reload} />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Lesson plans', a.academic_continuity.total_lesson_plans, 'Stored for cover classes'],
                ['Plans flagged provisional', a.academic_continuity.plans_with_continuity_warnings, `${a.academic_continuity.continuity_warning_rate_pct}% had no verified progress`],
                ['Verified progress records', a.academic_continuity.verified_progress_records, `of ${a.academic_continuity.lesson_progress_records} progress records`],
                ['Handover notes', a.academic_continuity.handover_notes_logged, 'Written by faculty'],
              ].map(([l, v, n]) => (
                <div key={l} className="ground-calc rounded-panel p-3.5">
                  <dt className="text-xs text-ink-2 flex items-center gap-1">
                    <Calculator className="w-3 h-3" />
                    {l}
                  </dt>
                  <dd className="font-heading font-black text-2xl text-ink tabular mt-1">{v}</dd>
                  <dd className="text-xs text-ink-3 mt-0.5">{n}</dd>
                </div>
              ))}
            </dl>
            <div className="panel p-4 text-sm">
              <p className="font-semibold text-ink flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-ink-3" />
                AI gateway use since server start
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-y-1 text-ink-2">
                <dt>Primary provider</dt>
                <dd className="text-right font-semibold text-ink">{a.ai_generation.active_primary_provider}</dd>
                <dt>Requests</dt>
                <dd className="text-right font-semibold text-ink tabular">{a.ai_generation.ai_requests}</dd>
                <dt>Succeeded</dt>
                <dd className="text-right font-semibold text-ink tabular">{a.ai_generation.ai_successes}</dd>
                <dt>Failed (rule-based output used)</dt>
                <dd className="text-right font-semibold text-ink tabular">{a.ai_generation.ai_failures ?? 0}</dd>
              </dl>
            </div>
          </div>
        )}
      </section>

      {/* Briefing */}
      <section className="sheet p-5" aria-labelledby="brief-h">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 id="brief-h" className="font-heading font-extrabold text-lg text-ink flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5 text-ink-3" />
              Today's operational briefing
            </h2>
            <p className="text-sm text-ink-2 mt-0.5">Today's counts are calculated first; the narrative is written from them.</p>
          </div>
          <button type="button" className="btn-primary no-print" onClick={generate} disabled={reportBusy}>
            {reportBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {reportBusy ? 'Writing briefing…' : report ? 'Regenerate briefing' : 'Generate briefing'}
          </button>
        </div>
        {reportError && (
          <div className="mt-4">
            <ErrorState compact title="No briefing this time" message={reportError} onRetry={generate} />
          </div>
        )}
        {report && (
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_2fr]">
            <div className="ground-verified rounded-panel p-4">
              <p className="text-xs font-semibold text-ok-ink flex items-center gap-1.5 mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                Institutional records, {formatDateLong(report.metrics?.date)}
              </p>
              <dl className="grid grid-cols-2 gap-y-1.5 text-sm text-ink-2">
                {[
                  ['Active faculty', report.metrics?.total_faculty],
                  ['Present', report.metrics?.present_today],
                  ['Absent', report.metrics?.absent_today],
                  ['Requests today', report.metrics?.total_substitutions],
                  ['Covered', report.metrics?.completed],
                  ['Open', report.metrics?.pending],
                  ['Suspended', report.metrics?.suspended],
                ].map(([l, v]) => (
                  <div key={l} className="contents">
                    <dt>{l}</dt>
                    <dd className="text-right font-semibold text-ink tabular">{v ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="ground-ai rounded-panel p-4">
              <p className="text-xs font-semibold text-info-ink flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                Generated narrative
              </p>
              <Markdown text={report.report} />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

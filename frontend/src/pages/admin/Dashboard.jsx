import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  CheckCircle2,
  AlertOctagon,
  CalendarDays,
  Sparkles,
  BarChart3,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Check,
  X,
} from 'lucide-react'
import StatCard from '../../components/StatCard'
import Badge from '../../components/Badge'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import { reportService } from '../../services/reportService'
import { substitutionService } from '../../services/substitutionService'
import { absenceService } from '../../services/absenceService'
import { useToast } from '../../context/ToastContext'

export default function Dashboard() {
  const [stats, setStats] = useState({
    total_faculty: 0,
    faculty_present: 0,
    faculty_absent: 0,
    pending_substitutions: 0,
    completed_substitutions: 0,
    suspended_classes: 0,
  })
  const [todaySubstitutions, setTodaySubstitutions] = useState([])
  const [recentAbsences, setRecentAbsences] = useState([])
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState(null)

  const toast = useToast()

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const [reportsData, subsData, absencesData] = await Promise.allSettled([
        reportService.getStats(),
        substitutionService.getAll({ date: new Date().toISOString().split('T')[0] }),
        absenceService.getAll({ limit: 5 }),
      ])

      if (reportsData.status === 'fulfilled') {
        const d = reportsData.value
        setStats({
          total_faculty: d.total_faculty ?? d.stats?.total_faculty ?? 42,
          faculty_present: d.faculty_present ?? d.stats?.faculty_present ?? 38,
          faculty_absent: d.faculty_absent ?? d.stats?.faculty_absent ?? 4,
          pending_substitutions: d.pending_substitutions ?? d.stats?.pending_substitutions ?? 2,
          completed_substitutions: d.completed_substitutions ?? d.stats?.completed_substitutions ?? 14,
          suspended_classes: d.suspended_classes ?? d.stats?.suspended_classes ?? 1,
        })
      }

      if (subsData.status === 'fulfilled') {
        const list = Array.isArray(subsData.value)
          ? subsData.value
          : subsData.value?.substitutions || []
        setTodaySubstitutions(list.slice(0, 5))
        const pending = list.filter(
          (s) => (s.status || '').toUpperCase() === 'PENDING' || (s.status || '').toUpperCase() === 'RECOMMENDED'
        )
        setPendingApprovals(pending.slice(0, 4))
      }

      if (absencesData.status === 'fulfilled') {
        const list = Array.isArray(absencesData.value)
          ? absencesData.value
          : absencesData.value?.absences || []
        setRecentAbsences(list.slice(0, 5))
      }
    } catch {
      toast.error('Could not sync complete dashboard data from server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  const handleQuickApprove = async (subId) => {
    setActionLoadingId(subId)
    try {
      await substitutionService.approve(subId)
      toast.success('Substitution request approved successfully!')
      setPendingApprovals((prev) => prev.filter((item) => item.id !== subId))
      loadDashboardData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve substitution.')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleQuickReject = async (subId) => {
    setActionLoadingId(subId)
    try {
      await substitutionService.reject(subId, { reason: 'Rejected from dashboard overview' })
      toast.warning('Substitution request rejected.')
      setPendingApprovals((prev) => prev.filter((item) => item.id !== subId))
      loadDashboardData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject substitution.')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Greeting calculation
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const attendanceRate =
    stats.total_faculty > 0
      ? Math.round((stats.faculty_present / stats.total_faculty) * 100)
      : 92

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-2xl p-6 border border-border shadow-card">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-accent bg-accent/10 px-3 py-1 rounded-full">
            {currentDateFormatted}
          </span>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-textPrimary mt-2">
            {greeting}, Administrator!
          </h1>
          <p className="text-sm text-textSecondary mt-1">
            Real-time timetable synchronization and automated faculty substitution overview.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/admin/absences"
            className="btn-primary text-xs shadow-sm"
          >
            <UserX className="w-3.5 h-3.5" />
            Report Absence
          </Link>
          <Link
            to="/admin/timetable"
            className="btn-secondary text-xs"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            View Timetable
          </Link>
          <Link
            to="/admin/ai-assistant"
            className="btn-secondary text-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Assistant
          </Link>
          <Link
            to="/admin/reports"
            className="btn-ghost text-xs"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            View Reports
          </Link>
        </div>
      </div>

      {/* 6 Stats Row */}
      {loading ? (
        <div className="card py-12 flex items-center justify-center">
          <LoadingSpinner message="Fetching live metrics..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            title="Total Faculty"
            value={stats.total_faculty}
            icon={Users}
            color="#B85C7A"
            subtitle="Registered staff"
          />
          <StatCard
            title="Faculty Present"
            value={stats.faculty_present}
            icon={UserCheck}
            color="#6B9E78"
            subtitle={`${attendanceRate}% attendance today`}
          />
          <StatCard
            title="Faculty Absent"
            value={stats.faculty_absent}
            icon={UserX}
            color="#C0616A"
            subtitle="Today's reported"
          />
          <StatCard
            title="Pending Subs"
            value={stats.pending_substitutions}
            icon={Clock}
            color="#E8A07A"
            subtitle="Needs admin action"
          />
          <StatCard
            title="Completed Subs"
            value={stats.completed_substitutions}
            icon={CheckCircle2}
            color="#6B9E78"
            subtitle="Successfully covered"
          />
          <StatCard
            title="Suspended Classes"
            value={stats.suspended_classes}
            icon={AlertOctagon}
            color="#C0616A"
            subtitle="No substitute available"
          />
        </div>
      )}

      {/* Split Grid: Today's Substitutions & Faculty Availability */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Today's Substitution Schedule */}
        <div className="lg:col-span-7 card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-accent" />
                <h3 className="font-heading font-bold text-base text-textPrimary">
                  Today's Substitution Dispatch
                </h3>
              </div>
              <Link
                to="/admin/substitutions"
                className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="mt-4 divide-y divide-border">
              {todaySubstitutions.length === 0 ? (
                <EmptyState
                  title="No substitutions today"
                  description="All scheduled classes currently have their assigned faculty or no disruptions have been reported."
                />
              ) : (
                todaySubstitutions.map((sub) => (
                  <div key={sub.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-secondary text-accent font-semibold text-xs flex items-center justify-center shrink-0 border border-border">
                        {sub.time_slot || sub.time || 'Period'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-textPrimary">
                            {sub.subject_name || sub.subject || 'Class Subject'}
                          </span>
                          <span className="text-xs text-textSecondary font-normal">
                            ({sub.class_name || sub.classroom || 'Hall A'})
                          </span>
                          <Badge status={sub.status || 'PENDING'} />
                        </div>
                        <p className="text-xs text-textSecondary mt-0.5">
                          Covering for{' '}
                          <span className="font-semibold text-textPrimary">
                            {sub.absent_faculty_name || sub.original_faculty || 'Absent Faculty'}
                          </span>
                          {' '}→ Assigned to{' '}
                          <span className="font-semibold text-accent">
                            {sub.substitute_faculty_name || sub.recommended_substitute || 'Pending Assignment'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/admin/substitutions?id=${sub.id}`}
                      className="text-xs text-accent hover:bg-secondary/60 px-3 py-1.5 rounded-lg border border-border self-start sm:self-auto font-medium"
                    >
                      Details
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-border mt-4 flex items-center justify-between text-xs text-textSecondary">
            <span>Showing today's priority schedule</span>
            <Link to="/admin/substitutions" className="text-accent hover:underline">
              Manage Dispatch Queue &rarr;
            </Link>
          </div>
        </div>

        {/* Right: Faculty Availability Overview */}
        <div className="lg:col-span-5 card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-accent" />
                <h3 className="font-heading font-bold text-base text-textPrimary">
                  Faculty Availability
                </h3>
              </div>
              <Link
                to="/admin/attendance"
                className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
              >
                Attendance log <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Attendance Progress Bar */}
            <div className="mt-5 space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-textPrimary mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-success inline-block" />
                    Present on Campus
                  </span>
                  <span>{stats.faculty_present} / {stats.total_faculty}</span>
                </div>
                <div className="w-full bg-border rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-success h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${stats.total_faculty ? (stats.faculty_present / stats.total_faculty) * 100 : 80}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-medium text-textPrimary mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-error inline-block" />
                    Absent / On Leave
                  </span>
                  <span>{stats.faculty_absent}</span>
                </div>
                <div className="w-full bg-border rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-error h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${stats.total_faculty ? (stats.faculty_absent / stats.total_faculty) * 100 : 10}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-medium text-textPrimary mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-warning inline-block" />
                    Substitutions in Progress
                  </span>
                  <span>{stats.pending_substitutions}</span>
                </div>
                <div className="w-full bg-border rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-warning h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${stats.total_faculty ? (stats.pending_substitutions / stats.total_faculty) * 100 : 15}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Summary Pill Box */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="p-3.5 rounded-xl bg-background border border-border">
                <span className="text-[11px] font-medium text-textSecondary">Attendance Rate</span>
                <p className="font-heading font-bold text-xl text-success mt-0.5">
                  {attendanceRate}%
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-background border border-border">
                <span className="text-[11px] font-medium text-textSecondary">Active Duty Hours</span>
                <p className="font-heading font-bold text-xl text-textPrimary mt-0.5">
                  09:00 - 17:00
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border mt-6">
            <Link
              to="/admin/attendance"
              className="w-full btn-secondary text-xs flex items-center justify-center py-2"
            >
              Verify Faculty Attendance
            </Link>
          </div>
        </div>
      </div>

      {/* Lower Row: Pending Substitutions Needing Approval & Recent Absences */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pending Approvals */}
        <div className="lg:col-span-7 card">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-warning" />
              <h3 className="font-heading font-bold text-base text-textPrimary">
                Pending Substitutions Needing Approval
              </h3>
            </div>
            <Link
              to="/admin/substitutions?status=PENDING"
              className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
            >
              View all
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {pendingApprovals.length === 0 ? (
              <EmptyState
                title="No pending substitution requests"
                description="Great work! All substitute assignments have been reviewed and dispatched."
              />
            ) : (
              pendingApprovals.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-xl border border-border bg-white hover:border-primary/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-semibold text-sm text-textPrimary">
                        {req.subject_name || req.subject || 'Core Subject'}
                      </span>
                      <span className="text-xs text-textSecondary font-medium">
                        [{req.class_name || req.classroom || 'Year 2'}]
                      </span>
                      <Badge status={req.status || 'PENDING'} />
                    </div>
                    <p className="text-xs text-textSecondary mt-1">
                      Absent: <span className="text-textPrimary font-medium">{req.absent_faculty_name || 'Faculty Member'}</span> &bull; Recommended:{' '}
                      <span className="text-accent font-semibold">
                        {req.recommended_substitute || req.substitute_faculty_name || 'AI Match'}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => handleQuickApprove(req.id)}
                      disabled={actionLoadingId === req.id}
                      className="px-3 py-1.5 rounded-lg bg-success text-white text-xs font-medium hover:bg-green-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                      title="Approve assignment"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleQuickReject(req.id)}
                      disabled={actionLoadingId === req.id}
                      className="px-3 py-1.5 rounded-lg bg-error/10 text-error hover:bg-error hover:text-white transition-colors text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                      title="Reject assignment"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Absences */}
        <div className="lg:col-span-5 card">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-error" />
              <h3 className="font-heading font-bold text-base text-textPrimary">
                Recent Absences Reported
              </h3>
            </div>
            <Link
              to="/admin/absences"
              className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
            >
              Report new
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {recentAbsences.length === 0 ? (
              <EmptyState
                title="No reported absences"
                description="Zero faculty absence records filed today."
              />
            ) : (
              recentAbsences.map((abs) => (
                <div
                  key={abs.id}
                  className="p-3.5 rounded-xl border border-border bg-background/50 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-xs text-textPrimary truncate">
                      {abs.faculty_name || abs.faculty?.name || 'Faculty Member'}
                    </p>
                    <p className="text-[11px] text-textSecondary truncate mt-0.5">
                      Reason: {abs.reason || 'Medical Leave'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-semibold text-accent bg-secondary px-2 py-0.5 rounded-full block">
                      {abs.date || 'Today'}
                    </span>
                    <span className="text-[10px] text-textSecondary block mt-1">
                      {abs.slots_count || abs.substitutions_count || 1} slots affected
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

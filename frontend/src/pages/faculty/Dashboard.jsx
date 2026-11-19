import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Bell,
  ArrowRight,
  ArrowLeftRight,
  UserCheck,
  Building,
  Check,
  AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Badge from '../../components/Badge'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import { timetableService } from '../../services/timetableService'
import { substitutionService } from '../../services/substitutionService'
import { notificationService } from '../../services/notificationService'
import { attendanceService } from '../../services/attendanceService'
import { useToast } from '../../context/ToastContext'

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

export default function FacultyDashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [todayClasses, setTodayClasses] = useState([])
  const [assignedSubs, setAssignedSubs] = useState([])
  const [recentNotifications, setRecentNotifications] = useState([])
  const [attendanceInfo, setAttendanceInfo] = useState({
    status: 'PRESENT',
    login_time: '08:42 AM',
  })
  const [ackLoadingId, setAckLoadingId] = useState(null)

  const toast = useToast()

  const todayDayName = DAYS[new Date().getDay()]

  const loadFacultyDashboard = async () => {
    setLoading(true)
    try {
      const [ttRes, subRes, notifRes, attRes] = await Promise.allSettled([
        timetableService.getAll({ faculty_id: user?.id }),
        substitutionService.getAll({ substitute_id: user?.id }),
        notificationService.getAll(),
        attendanceService.getToday(),
      ])

      if (ttRes.status === 'fulfilled') {
        const list = Array.isArray(ttRes.value) ? ttRes.value : ttRes.value?.timetable || []
        // Filter to today's classes
        const today = list.filter(
          (c) => (c.day || '').toUpperCase() === todayDayName
        )
        setTodayClasses(today.length > 0 ? today : list.slice(0, 4))
      }

      if (subRes.status === 'fulfilled') {
        const list = Array.isArray(subRes.value) ? subRes.value : subRes.value?.substitutions || []
        setAssignedSubs(list)
      }

      if (notifRes.status === 'fulfilled') {
        const list = Array.isArray(notifRes.value)
          ? notifRes.value
          : notifRes.value?.notifications || []
        setRecentNotifications(list.slice(0, 4))
      }

      if (attRes.status === 'fulfilled') {
        const att = attRes.value
        setAttendanceInfo({
          status: att.status || 'PRESENT',
          login_time: att.login_time || '08:45 AM',
        })
      }
    } catch {
      toast.error('Unable to fetch live faculty workspace details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFacultyDashboard()
  }, [user])

  const handleAcknowledge = async (subId) => {
    setAckLoadingId(subId)
    try {
      await substitutionService.acknowledge(subId)
      toast.success('Substitution assignment acknowledged.')
      setAssignedSubs((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, status: 'ACKNOWLEDGED' } : s))
      )
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to acknowledge assignment.')
    } finally {
      setAckLoadingId(null)
    }
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const facultyName = user?.name || 'Faculty Member'

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner Greeting */}
      <div className="bg-white rounded-2xl p-6 border border-border shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-accent bg-accent/10 px-3 py-1 rounded-full">
            Faculty Teaching Hub
          </span>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-textPrimary mt-2">
            {greeting}, {facultyName}!
          </h1>
          <p className="text-sm text-textSecondary mt-1">
            Department of {user?.department?.name || user?.department_name || 'Academic Studies'} &bull; Today is {todayDayName}
          </p>
        </div>

        {/* Attendance Status Card */}
        <div className="p-4 rounded-xl bg-secondary/30 border border-border flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-success/15 text-success flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-textSecondary uppercase font-medium">Daily Attendance:</span>
              <Badge status={attendanceInfo.status} />
            </div>
            <p className="text-xs text-textPrimary font-mono mt-0.5">
              Logged in at: {attendanceInfo.login_time}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Timetable & Assigned Substitutions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Today's Classes */}
        <div className="lg:col-span-7 card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-accent" />
                <h3 className="font-heading font-bold text-base text-textPrimary">
                  Today's Teaching Schedule ({todayDayName})
                </h3>
              </div>
              <Link
                to="/faculty/timetable"
                className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
              >
                Full week <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner size="sm" message="Loading today's classes..." />
              </div>
            ) : todayClasses.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No classes scheduled today"
                description="You have no lectures or laboratory sessions assigned for this day."
              />
            ) : (
              <div className="space-y-3">
                {todayClasses.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-3.5 rounded-xl border border-border bg-white hover:border-primary/50 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-secondary text-accent font-heading font-bold text-xs flex flex-col items-center justify-center border border-border shrink-0">
                        <Clock className="w-4 h-4 mb-0.5" />
                        <span className="text-[10px] font-mono leading-none">
                          {item.start_time || item.time_slot?.split(' - ')[0] || 'Period'}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-bold text-sm text-textPrimary">
                            {item.subject_name || item.subject?.name || 'Class Subject'}
                          </span>
                          <span className="text-xs text-textSecondary font-medium">
                            ({item.class_name || 'Standard Cohort'})
                          </span>
                        </div>
                        <p className="text-xs text-textSecondary mt-0.5">
                          Room: <span className="font-semibold text-accent">{item.classroom || 'Lecture Hall'}</span> &bull; Section: {item.section || 'A'}
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-background border border-border text-textSecondary">
                      {item.time_slot || 'Standard Hour'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border mt-4 text-xs text-textSecondary flex justify-between items-center">
            <span>{todayClasses.length} session{todayClasses.length !== 1 ? 's' : ''} on schedule</span>
            <Link to="/faculty/timetable" className="text-accent hover:underline">
              View weekly timetable grid &rarr;
            </Link>
          </div>
        </div>

        {/* Assigned Substitutions Needing Acknowledgment */}
        <div className="lg:col-span-5 card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-info" />
                <h3 className="font-heading font-bold text-base text-textPrimary">
                  Assigned Substitutions
                </h3>
              </div>
              <Link
                to="/faculty/substitutions"
                className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner size="sm" message="Checking assigned duties..." />
              </div>
            ) : assignedSubs.length === 0 ? (
              <EmptyState
                icon={ArrowLeftRight}
                title="No assigned substitutions"
                description="You have no pending coverage requests assigned to you."
              />
            ) : (
              <div className="space-y-3">
                {assignedSubs.slice(0, 3).map((sub) => {
                  const needsAck =
                    (sub.status || '').toUpperCase() === 'APPROVED' ||
                    (sub.status || '').toUpperCase() === 'PENDING'

                  return (
                    <div
                      key={sub.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        needsAck
                          ? 'bg-secondary/20 border-accent/40 shadow-sm'
                          : 'bg-white border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-textPrimary">
                              {sub.subject_name || sub.subject || 'Class Subject'}
                            </span>
                            <Badge status={sub.status || 'PENDING'} />
                          </div>
                          <p className="text-[11px] text-textSecondary mt-1">
                            Covering for:{' '}
                            <strong className="text-textPrimary">
                              {sub.absent_faculty_name || 'Faculty Member'}
                            </strong>
                          </p>
                          <p className="text-[11px] text-textSecondary font-mono mt-0.5">
                            {sub.date} &bull; {sub.time_slot || 'Period'} &bull; {sub.classroom || 'Hall 2'}
                          </p>
                        </div>

                        {needsAck && (
                          <button
                            onClick={() => handleAcknowledge(sub.id)}
                            disabled={ackLoadingId === sub.id}
                            className="btn-primary text-xs py-1.5 px-3 shrink-0 shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Acknowledge
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border mt-4 text-center">
            <Link
              to="/faculty/substitutions"
              className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1"
            >
              Open Substitution Duty Portal &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Lower Row: Recent Notifications */}
      <div className="card">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-accent" />
            <h3 className="font-heading font-bold text-base text-textPrimary">
              Recent Announcements & Schedule Updates
            </h3>
          </div>
          <Link
            to="/faculty/notifications"
            className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
          >
            All notifications <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentNotifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No new notifications"
            description="All notifications have been reviewed."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentNotifications.map((n) => (
              <div
                key={n.id}
                className="p-3.5 rounded-xl border border-border bg-white flex items-start gap-3"
              >
                <div className="p-2 rounded-xl bg-secondary/50 text-accent shrink-0 mt-0.5">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-xs text-textPrimary truncate">
                    {n.title || n.message}
                  </p>
                  {n.title && n.message && (
                    <p className="text-[11px] text-textSecondary mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                  )}
                  <span className="text-[10px] text-textSecondary font-mono block mt-1">
                    {n.created_at || n.time || 'Today'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

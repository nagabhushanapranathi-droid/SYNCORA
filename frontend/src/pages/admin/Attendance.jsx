import { useState, useEffect, useMemo } from 'react'
import {
  CalendarCheck,
  Calendar,
  Clock,
  UserCheck,
  UserX,
  LogOut,
  Edit3,
  Search,
  Filter,
  RefreshCw,
} from 'lucide-react'
import StatCard from '../../components/StatCard'
import Modal from '../../components/Modal'
import Badge from '../../components/Badge'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import { attendanceService } from '../../services/attendanceService'
import { useToast } from '../../context/ToastContext'

export default function Attendance() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('ALL')
  const [search, setSearch] = useState('')

  // Override Modal state
  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [overrideStatus, setOverrideStatus] = useState('PRESENT')
  const [overrideNotes, setOverrideNotes] = useState('')
  const [savingOverride, setSavingOverride] = useState(false)

  const toast = useToast()

  const loadAttendance = async (date) => {
    setLoading(true)
    try {
      const data = await attendanceService.getAll({ date })
      const list = Array.isArray(data) ? data : data.attendance || []
      setAttendanceRecords(list)
    } catch {
      toast.error('Unable to fetch attendance records for this date.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAttendance(selectedDate)
  }, [selectedDate])

  // Summary counts
  const summary = useMemo(() => {
    let present = 0
    let absent = 0
    let loggedOut = 0

    attendanceRecords.forEach((r) => {
      const status = (r.status || '').toUpperCase()
      if (status === 'PRESENT') present++
      else if (status === 'ABSENT') absent++
      else if (status === 'LOGGED_OUT' || status === 'LOGGED OUT') loggedOut++
      else present++
    })

    return {
      present,
      absent,
      loggedOut,
      total: attendanceRecords.length,
    }
  }, [attendanceRecords])

  // Filtered list
  const filteredList = useMemo(() => {
    return attendanceRecords.filter((r) => {
      const status = (r.status || 'PRESENT').toUpperCase()
      const matchesTab =
        activeTab === 'ALL' ||
        (activeTab === 'PRESENT' && status === 'PRESENT') ||
        (activeTab === 'ABSENT' && status === 'ABSENT') ||
        (activeTab === 'LOGGED_OUT' && (status === 'LOGGED_OUT' || status === 'LOGGED OUT'))

      const name = r.faculty_name || r.name || ''
      const dept = r.department_name || r.department || ''
      const matchesSearch =
        name.toLowerCase().includes(search.toLowerCase()) ||
        dept.toLowerCase().includes(search.toLowerCase())

      return matchesTab && matchesSearch
    })
  }, [attendanceRecords, activeTab, search])

  const handleOpenOverride = (record) => {
    setSelectedRecord(record)
    setOverrideStatus((record.status || 'PRESENT').toUpperCase())
    setOverrideNotes(record.notes || record.remarks || '')
    setOverrideModalOpen(true)
  }

  const handleSaveOverride = async (e) => {
    e.preventDefault()
    if (!selectedRecord) return
    setSavingOverride(true)
    try {
      await attendanceService.override(selectedRecord.id || selectedRecord.faculty_id, {
        status: overrideStatus,
        notes: overrideNotes,
        date: selectedDate,
      })
      toast.success('Attendance status successfully updated.')
      setOverrideModalOpen(false)
      loadAttendance(selectedDate)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update attendance override.')
    } finally {
      setSavingOverride(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Date & Filter Banner */}
      <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-bold text-lg text-textPrimary">
            Faculty Attendance Log
          </h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Biometric verification, system log-in times, and administrative manual overrides.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-secondary/30 px-3 py-1.5 rounded-xl border border-border">
            <Calendar className="w-4 h-4 text-accent" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm font-semibold text-textPrimary focus:outline-none"
            />
          </div>
          <button
            onClick={() => loadAttendance(selectedDate)}
            className="p-2.5 rounded-xl border border-border bg-white text-textSecondary hover:text-accent hover:border-primary transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Scheduled"
          value={summary.total}
          icon={CalendarCheck}
          color="#B85C7A"
          subtitle="Staff on roster"
        />
        <StatCard
          title="Present On Campus"
          value={summary.present}
          icon={UserCheck}
          color="#6B9E78"
          subtitle="Punched in"
        />
        <StatCard
          title="Reported Absent"
          value={summary.absent}
          icon={UserX}
          color="#C0616A"
          subtitle="Requires substitute"
        />
        <StatCard
          title="Logged Out"
          value={summary.loggedOut}
          icon={LogOut}
          color="#827680"
          subtitle="Completed duties"
        />
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex p-1 bg-white border border-border rounded-xl w-fit shadow-sm">
          {[
            { id: 'ALL', label: `All (${summary.total})` },
            { id: 'PRESENT', label: `Present (${summary.present})` },
            { id: 'ABSENT', label: `Absent (${summary.absent})` },
            { id: 'LOGGED_OUT', label: `Logged Out (${summary.loggedOut})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-textSecondary hover:text-textPrimary hover:bg-secondary/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-textSecondary" />
          <input
            type="text"
            placeholder="Search faculty name or dept..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-xs"
          />
        </div>
      </div>

      {/* Attendance Table */}
      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner message="Loading attendance records..." />
          </div>
        ) : filteredList.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No attendance records found"
            description={`No faculty matching '${activeTab}' on ${selectedDate}.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/30 text-textSecondary text-xs uppercase font-semibold tracking-wider">
                  <th className="py-3.5 px-6">Faculty Member</th>
                  <th className="py-3.5 px-6">Department</th>
                  <th className="py-3.5 px-6">Login Time</th>
                  <th className="py-3.5 px-6">Logout Time</th>
                  <th className="py-3.5 px-6 text-center">Status</th>
                  <th className="py-3.5 px-6 text-right">Administrative Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filteredList.map((rec, i) => {
                  const name = rec.faculty_name || rec.name || 'Faculty Member'
                  const dept = rec.department_name || rec.department || 'Computer Science'
                  const status = (rec.status || 'PRESENT').toUpperCase()
                  const loginTime = rec.login_time || rec.time_in || (status === 'PRESENT' ? '08:45 AM' : '--:--')
                  const logoutTime = rec.logout_time || rec.time_out || (status === 'LOGGED_OUT' ? '04:30 PM' : '--:--')
                  const initials = name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()

                  return (
                    <tr
                      key={rec.id || i}
                      className="hover:bg-background/80 transition-colors"
                    >
                      {/* Name & Initials */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-secondary text-accent font-heading font-bold text-xs flex items-center justify-center border border-border shrink-0">
                            {initials}
                          </div>
                          <div>
                            <span className="font-semibold text-textPrimary block">
                              {name}
                            </span>
                            <span className="text-xs text-textSecondary">
                              {rec.designation || 'Faculty Member'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-4 px-6 text-xs text-textSecondary font-medium">
                        {dept}
                      </td>

                      {/* Login Time */}
                      <td className="py-4 px-6 text-xs text-textPrimary">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-success" />
                          <span className="font-mono">{loginTime}</span>
                        </div>
                      </td>

                      {/* Logout Time */}
                      <td className="py-4 px-6 text-xs text-textSecondary">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-textSecondary" />
                          <span className="font-mono">{logoutTime}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6 text-center">
                        <Badge status={status} />
                      </td>

                      {/* Override Button */}
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleOpenOverride(rec)}
                          className="btn-secondary text-xs py-1.5 px-3 font-semibold shadow-sm inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Override
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Override Status Modal */}
      <Modal
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        title="Override Faculty Attendance"
        subtitle={`Manually adjust attendance record for ${selectedRecord?.faculty_name || selectedRecord?.name || 'Faculty Member'}.`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOverrideModalOpen(false)}
              className="btn-ghost text-sm"
              disabled={savingOverride}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="override-form"
              className="btn-primary text-sm shadow-sm"
              disabled={savingOverride}
            >
              {savingOverride ? 'Updating...' : 'Save Override'}
            </button>
          </>
        }
      >
        <form id="override-form" onSubmit={handleSaveOverride} className="space-y-4">
          <div>
            <label className="label">New Attendance Status</label>
            <select
              value={overrideStatus}
              onChange={(e) => setOverrideStatus(e.target.value)}
              className="input-field"
            >
              <option value="PRESENT">Present (On Campus)</option>
              <option value="ABSENT">Absent (On Leave / Unexcused)</option>
              <option value="LOGGED_OUT">Logged Out (Early Departure)</option>
            </select>
          </div>

          <div>
            <label className="label">Reason / Administrative Notes</label>
            <textarea
              required
              rows={3}
              value={overrideNotes}
              onChange={(e) => setOverrideNotes(e.target.value)}
              placeholder="e.g. Biometric reader sync failure; confirmed in classroom Lab 3"
              className="input-field"
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}

import { useState, useEffect, useMemo } from 'react'
import {
  CalendarDays,
  Plus,
  Filter,
  Users,
  Building,
  Clock,
  AlertTriangle,
  Edit2,
  Trash2,
  X,
  Sparkles,
} from 'lucide-react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import LoadingSpinner from '../../components/LoadingSpinner'
import { timetableService } from '../../services/timetableService'
import { facultyService } from '../../services/facultyService'
import { departmentService } from '../../services/departmentService'
import { subjectService } from '../../services/subjectService'
import { useToast } from '../../context/ToastContext'

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
const TIME_SLOTS = [
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:15 - 12:15',
  '12:15 - 01:15',
  '02:00 - 03:00',
  '03:00 - 04:00',
  '04:00 - 05:00',
]

export default function Timetable() {
  const [timetableEntries, setTimetableEntries] = useState([])
  const [facultyList, setFacultyList] = useState([])
  const [departments, setDepartments] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [selectedFaculty, setSelectedFaculty] = useState('ALL')
  const [selectedDept, setSelectedDept] = useState('ALL')

  // Add / Edit Entry Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [formData, setFormData] = useState({
    faculty_id: '',
    subject_id: '',
    department_id: '',
    class_name: '',
    section: 'A',
    classroom: '',
    day: 'MONDAY',
    start_time: '09:00',
    end_time: '10:00',
    time_slot: '09:00 - 10:00',
  })
  const [savingEntry, setSavingEntry] = useState(false)
  const [conflictError, setConflictError] = useState('')

  // View / Detail Modal
  const [viewEntry, setViewEntry] = useState(null)

  // Delete Confirm
  const [deleteId, setDeleteId] = useState(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const toast = useToast()

  const loadData = async () => {
    setLoading(true)
    try {
      const [ttRes, facRes, deptRes, subRes] = await Promise.allSettled([
        timetableService.getAll(),
        facultyService.getAll(),
        departmentService.getAll(),
        subjectService.getAll(),
      ])

      if (ttRes.status === 'fulfilled') {
        const list = Array.isArray(ttRes.value) ? ttRes.value : ttRes.value?.timetable || []
        setTimetableEntries(list)
      }
      if (facRes.status === 'fulfilled') {
        const facs = Array.isArray(facRes.value) ? facRes.value : facRes.value?.faculty || []
        setFacultyList(facs)
      }
      if (deptRes.status === 'fulfilled') {
        const depts = Array.isArray(deptRes.value) ? deptRes.value : deptRes.value?.departments || []
        setDepartments(depts)
      }
      if (subRes.status === 'fulfilled') {
        const subs = Array.isArray(subRes.value) ? subRes.value : subRes.value?.subjects || []
        setSubjects(subs)
      }
    } catch {
      toast.error('Failed to sync master timetable data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered timetable entries
  const filteredEntries = useMemo(() => {
    return timetableEntries.filter((item) => {
      const facId = item.faculty_id || item.faculty?.id
      const deptId = item.department_id || item.department?.id
      const matchesFaculty = selectedFaculty === 'ALL' || String(facId) === String(selectedFaculty)
      const matchesDept = selectedDept === 'ALL' || String(deptId) === String(selectedDept)
      return matchesFaculty && matchesDept
    })
  }, [timetableEntries, selectedFaculty, selectedDept])

  // Lookup map: `${day}_${timeSlot}` -> entry
  const timetableMap = useMemo(() => {
    const map = {}
    filteredEntries.forEach((entry) => {
      const day = (entry.day || '').toUpperCase()
      const slot = entry.time_slot || `${entry.start_time || '09:00'} - ${entry.end_time || '10:00'}`
      // Normalize slot match
      const matchingSlot = TIME_SLOTS.find(
        (ts) => ts === slot || slot.startsWith(ts.split(' - ')[0])
      ) || slot

      const key = `${day}_${matchingSlot}`
      map[key] = entry
    })
    return map
  }, [filteredEntries])

  const handleOpenAdd = (day = 'MONDAY', slot = '09:00 - 10:00') => {
    setEditingEntry(null)
    setConflictError('')
    const [start, end] = slot.split(' - ')
    setFormData({
      faculty_id: facultyList[0]?.id || '',
      subject_id: subjects[0]?.id || '',
      department_id: departments[0]?.id || '',
      class_name: 'CSE 3rd Year',
      section: 'A',
      classroom: 'Hall 101',
      day: day || 'MONDAY',
      start_time: start || '09:00',
      end_time: end || '10:00',
      time_slot: slot,
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (entry) => {
    setEditingEntry(entry)
    setConflictError('')
    const slot = entry.time_slot || `${entry.start_time} - ${entry.end_time}`
    setFormData({
      faculty_id: entry.faculty_id || entry.faculty?.id || '',
      subject_id: entry.subject_id || entry.subject?.id || '',
      department_id: entry.department_id || entry.department?.id || '',
      class_name: entry.class_name || '',
      section: entry.section || 'A',
      classroom: entry.classroom || '',
      day: (entry.day || 'MONDAY').toUpperCase(),
      start_time: entry.start_time || slot.split(' - ')[0] || '09:00',
      end_time: entry.end_time || slot.split(' - ')[1] || '10:00',
      time_slot: slot,
    })
    setViewEntry(null)
    setIsModalOpen(true)
  }

  const handleSaveEntry = async (e) => {
    e.preventDefault()
    setConflictError('')
    setSavingEntry(true)

    const payload = {
      ...formData,
      time_slot: formData.time_slot || `${formData.start_time} - ${formData.end_time}`,
    }

    try {
      if (editingEntry) {
        await timetableService.update(editingEntry.id, payload)
        toast.success('Timetable entry updated successfully.')
      } else {
        await timetableService.create(payload)
        toast.success('New class slot added to schedule.')
      }
      setIsModalOpen(false)
      loadData()
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Schedule conflict detected: Faculty or classroom is already booked for this slot.'
      setConflictError(msg)
      toast.error(msg)
    } finally {
      setSavingEntry(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await timetableService.delete(deleteId)
      toast.success('Timetable slot removed.')
      setIsDeleteOpen(false)
      setViewEntry(null)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove timetable entry.')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Filters & Actions Bar */}
      <div className="card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Faculty Selector */}
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            <select
              value={selectedFaculty}
              onChange={(e) => setSelectedFaculty(e.target.value)}
              className="input-field text-xs sm:w-56"
            >
              <option value="ALL">All Faculty Schedules</option>
              {facultyList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Department Selector */}
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-accent" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="input-field text-xs sm:w-48"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name || d.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Legend & Add Button */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-3 text-xs font-medium text-textSecondary">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#F7DCE5] border border-[#E8A0B4]" />
              Regular Class
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#EBE9F8] border border-[#8B84C4]" />
              Substitution
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#FCE8EA] border border-[#C0616A]" />
              Suspended
            </span>
          </div>

          <button
            onClick={() => handleOpenAdd()}
            className="btn-primary text-xs shadow-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
        </div>
      </div>

      {/* Timetable Weekly Grid */}
      <div className="card !p-0 overflow-hidden shadow-card">
        {loading ? (
          <div className="py-24 flex justify-center">
            <LoadingSpinner message="Loading weekly timetable matrix..." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-secondary/40 border-b border-border">
                  <th className="p-3.5 text-center text-xs font-heading font-semibold text-textSecondary uppercase tracking-wider w-32 border-r border-border">
                    Time Slot
                  </th>
                  {DAYS.map((day) => (
                    <th
                      key={day}
                      className="p-3.5 text-center text-xs font-heading font-semibold text-textPrimary uppercase tracking-wider border-r border-border last:border-r-0"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {TIME_SLOTS.map((slot) => (
                  <tr key={slot} className="hover:bg-background/40 transition-colors">
                    {/* Time Column */}
                    <td className="p-3.5 text-center text-xs font-mono font-medium text-textSecondary bg-background/50 border-r border-border whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3 text-accent" />
                        {slot}
                      </div>
                    </td>

                    {/* Day Cells */}
                    {DAYS.map((day) => {
                      const key = `${day}_${slot}`
                      const entry = timetableMap[key]

                      if (!entry) {
                        return (
                          <td
                            key={key}
                            className="p-2 border-r border-border last:border-r-0 text-center align-top group hover:bg-secondary/20 transition-colors"
                          >
                            <button
                              onClick={() => handleOpenAdd(day, slot)}
                              className="w-full h-16 rounded-xl border border-dashed border-border group-hover:border-primary/60 flex items-center justify-center text-transparent group-hover:text-accent transition-all text-xs font-medium"
                              title={`Schedule class for ${day} ${slot}`}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </td>
                        )
                      }

                      // Determine chip styling based on entry type/status
                      const isSub = Boolean(entry.is_substitution || entry.substitution_id)
                      const isSuspended =
                        (entry.status || '').toUpperCase() === 'SUSPENDED'

                      let chipStyle =
                        'bg-[#F7DCE5] text-accent border-[#E8A0B4] hover:bg-[#F3CAD6]'
                      if (isSub) {
                        chipStyle =
                          'bg-[#EBE9F8] text-info border-[#8B84C4] hover:bg-[#E0DCF4]'
                      } else if (isSuspended) {
                        chipStyle =
                          'bg-[#FCE8EA] text-error border-[#C0616A] line-through opacity-80'
                      }

                      return (
                        <td
                          key={key}
                          className="p-2 border-r border-border last:border-r-0 align-top"
                        >
                          <div
                            onClick={() => setViewEntry(entry)}
                            className={`p-2.5 rounded-xl border cursor-pointer transition-all shadow-sm ${chipStyle} text-left flex flex-col justify-between min-h-[72px]`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-heading font-bold text-xs truncate leading-tight">
                                  {entry.subject_name || entry.subject?.name || 'Class Subject'}
                                </span>
                                {isSub && (
                                  <span className="text-[9px] font-bold uppercase bg-info/20 text-info px-1 rounded shrink-0">
                                    SUB
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-medium opacity-90 block mt-0.5 truncate">
                                {entry.faculty_name || entry.faculty?.name || 'Faculty'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[10px] opacity-80 mt-1.5 pt-1 border-t border-current/10">
                              <span>{entry.class_name || 'Year 2'}</span>
                              <span>{entry.classroom || 'Lab 1'}</span>
                            </div>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Entry Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEntry ? 'Edit Timetable Slot' : 'Add Class to Timetable'}
        subtitle="Specify subject, assigned faculty, classroom, and scheduling details."
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn-ghost text-sm"
              disabled={savingEntry}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="timetable-form"
              className="btn-primary text-sm shadow-sm"
              disabled={savingEntry}
            >
              {savingEntry ? 'Verifying & Saving...' : editingEntry ? 'Save Changes' : 'Add Class'}
            </button>
          </>
        }
      >
        <form id="timetable-form" onSubmit={handleSaveEntry} className="space-y-4">
          {conflictError && (
            <div className="p-3.5 rounded-xl bg-error/10 border border-error/20 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
              <div className="text-xs text-error font-medium">
                {conflictError}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Day of Week</label>
              <select
                value={formData.day}
                onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                className="input-field"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Standard Time Slot</label>
              <select
                value={formData.time_slot}
                onChange={(e) => {
                  const slot = e.target.value
                  const [start, end] = slot.split(' - ')
                  setFormData({
                    ...formData,
                    time_slot: slot,
                    start_time: start,
                    end_time: end,
                  })
                }}
                className="input-field"
              >
                {TIME_SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Subject</label>
              <select
                required
                value={formData.subject_id}
                onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                className="input-field"
              >
                <option value="">Select Subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code || 'CORE'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Assigned Faculty</label>
              <select
                required
                value={formData.faculty_id}
                onChange={(e) => setFormData({ ...formData, faculty_id: e.target.value })}
                className="input-field"
              >
                <option value="">Select Faculty</option>
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Department</label>
              <select
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="input-field"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || d.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Class / Cohort</label>
              <input
                type="text"
                required
                value={formData.class_name}
                onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                placeholder="e.g. CSE 3rd Year"
                className="input-field"
              />
            </div>

            <div>
              <label className="label">Classroom / Room</label>
              <input
                type="text"
                required
                value={formData.classroom}
                onChange={(e) => setFormData({ ...formData, classroom: e.target.value })}
                placeholder="e.g. Lab 204"
                className="input-field"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* View Entry Details Modal */}
      <Modal
        isOpen={Boolean(viewEntry)}
        onClose={() => setViewEntry(null)}
        title={viewEntry?.subject_name || viewEntry?.subject?.name || 'Class Slot Details'}
        subtitle={`${viewEntry?.day || ''} &bull; ${viewEntry?.time_slot || ''}`}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setDeleteId(viewEntry.id)
                setIsDeleteOpen(true)
              }}
              className="text-xs text-error hover:bg-error/10 px-3 py-2 rounded-xl font-medium transition-colors inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Remove Slot
            </button>
            <button
              type="button"
              onClick={() => handleOpenEdit(viewEntry)}
              className="btn-primary text-xs shadow-sm inline-flex items-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit Slot
            </button>
          </>
        }
      >
        {viewEntry && (
          <div className="space-y-4 text-sm">
            <div className="p-4 rounded-xl bg-secondary/30 border border-border flex items-center justify-between">
              <div>
                <span className="text-xs text-textSecondary uppercase font-medium">Assigned Faculty</span>
                <p className="font-heading font-bold text-base text-textPrimary mt-0.5">
                  {viewEntry.faculty_name || viewEntry.faculty?.name || 'Faculty Member'}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent">
                {viewEntry.classroom || 'Classroom N/A'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-border bg-white">
                <span className="text-textSecondary block">Target Cohort</span>
                <span className="font-semibold text-textPrimary mt-1 block">
                  {viewEntry.class_name || 'Standard Cohort'} (Sec {viewEntry.section || 'A'})
                </span>
              </div>
              <div className="p-3 rounded-xl border border-border bg-white">
                <span className="text-textSecondary block">Slot Time</span>
                <span className="font-semibold text-textPrimary mt-1 block font-mono">
                  {viewEntry.time_slot || `${viewEntry.start_time} - ${viewEntry.end_time}`}
                </span>
              </div>
            </div>

            {viewEntry.is_substitution && (
              <div className="p-3 rounded-xl bg-info/10 border border-info/20 text-xs text-info flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>
                  This slot is currently active under a substitution agreement covering for{' '}
                  <strong>{viewEntry.original_faculty_name || 'Original Faculty'}</strong>.
                </span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Remove Timetable Slot"
        message="Are you sure you want to remove this schedule slot from the master timetable?"
        confirmText="Remove Slot"
        isDestructive={true}
        loading={deleting}
      />
    </div>
  )
}

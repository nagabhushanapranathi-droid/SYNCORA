import { useState, useEffect, useMemo } from 'react'
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  BookOpen,
  Mail,
  Award,
  Calendar,
  Check,
  Building,
  GraduationCap,
} from 'lucide-react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import Badge from '../../components/Badge'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import { facultyService } from '../../services/facultyService'
import { departmentService } from '../../services/departmentService'
import { subjectService } from '../../services/subjectService'
import { useToast } from '../../context/ToastContext'

export default function Faculty() {
  const [facultyList, setFacultyList] = useState([])
  const [departments, setDepartments] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [selectedDept, setSelectedDept] = useState('ALL')

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false)
  const [editingFaculty, setEditingFaculty] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    department_id: '',
    designation: 'Assistant Professor',
    specialization: '',
  })
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Subject Assignment Modal
  const [isSubjectsOpen, setIsSubjectsOpen] = useState(false)
  const [selectedFacultyForSubjects, setSelectedFacultyForSubjects] = useState(null)
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([])
  const [assigningSubjects, setAssigningSubjects] = useState(false)

  // Profile View Modal
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [profileFaculty, setProfileFaculty] = useState(null)
  const [profileHistory, setProfileHistory] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  // Delete Confirm
  const [deleteId, setDeleteId] = useState(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const toast = useToast()

  const loadData = async () => {
    setLoading(true)
    try {
      const [facRes, deptRes, subRes] = await Promise.allSettled([
        facultyService.getAll(),
        departmentService.getAll(),
        subjectService.getAll(),
      ])

      if (facRes.status === 'fulfilled') {
        const list = Array.isArray(facRes.value) ? facRes.value : facRes.value?.faculty || []
        setFacultyList(list)
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
      toast.error('Failed to load faculty directory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered List
  const filteredFaculty = useMemo(() => {
    return facultyList.filter((f) => {
      const matchesSearch =
        f.name?.toLowerCase().includes(search.toLowerCase()) ||
        f.email?.toLowerCase().includes(search.toLowerCase()) ||
        f.designation?.toLowerCase().includes(search.toLowerCase()) ||
        f.specialization?.toLowerCase().includes(search.toLowerCase())
      const deptId = f.department_id || f.department?.id
      const matchesDept = selectedDept === 'ALL' || String(deptId) === String(selectedDept)
      return matchesSearch && matchesDept
    })
  }, [facultyList, search, selectedDept])

  const handleOpenAdd = () => {
    setEditingFaculty(null)
    setFormData({
      name: '',
      email: '',
      password: '',
      department_id: departments[0]?.id || '',
      designation: 'Assistant Professor',
      specialization: '',
    })
    setIsAddEditOpen(true)
  }

  const handleOpenEdit = (faculty) => {
    setEditingFaculty(faculty)
    setFormData({
      name: faculty.name || '',
      email: faculty.email || '',
      password: '',
      department_id: faculty.department_id || faculty.department?.id || '',
      designation: faculty.designation || 'Assistant Professor',
      specialization: faculty.specialization || '',
    })
    setIsAddEditOpen(true)
  }

  const handleSaveFaculty = async (e) => {
    e.preventDefault()
    setFormSubmitting(true)
    try {
      if (editingFaculty) {
        const payload = { ...formData }
        if (!payload.password) delete payload.password
        await facultyService.update(editingFaculty.id, payload)
        toast.success('Faculty profile updated successfully.')
      } else {
        await facultyService.create(formData)
        toast.success('New faculty member added.')
      }
      setIsAddEditOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save faculty details.')
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleOpenSubjectAssign = (faculty) => {
    setSelectedFacultyForSubjects(faculty)
    const existing = (faculty.subjects || []).map((s) => s.id || s)
    setSelectedSubjectIds(existing)
    setIsSubjectsOpen(true)
  }

  const handleSaveSubjects = async () => {
    if (!selectedFacultyForSubjects) return
    setAssigningSubjects(true)
    try {
      await facultyService.assignSubjects(selectedFacultyForSubjects.id, selectedSubjectIds)
      toast.success('Assigned subjects updated.')
      setIsSubjectsOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update subject assignments.')
    } finally {
      setAssigningSubjects(false)
    }
  }

  const handleOpenProfile = async (faculty) => {
    setProfileFaculty(faculty)
    setIsProfileOpen(true)
    setProfileLoading(true)
    try {
      const history = await facultyService.getHistory(faculty.id)
      setProfileHistory(history)
    } catch {
      setProfileHistory(null)
    } finally {
      setProfileLoading(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await facultyService.delete(deleteId)
      toast.success('Faculty removed successfully.')
      setIsDeleteOpen(false)
      setFacultyList((prev) => prev.filter((f) => f.id !== deleteId))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete faculty record.')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 max-w-2xl">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-textSecondary" />
            <input
              type="text"
              placeholder="Search faculty by name, specialization, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="input-field sm:w-56"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name || d.code}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleOpenAdd}
          className="btn-primary text-sm whitespace-nowrap shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Faculty
        </button>
      </div>

      {/* Faculty Directory Table */}
      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner message="Loading faculty directory..." />
          </div>
        ) : filteredFaculty.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No faculty members found"
            description="Try modifying your search or department filter, or add a new faculty member."
            actionLabel="Add Faculty"
            onAction={handleOpenAdd}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/30 text-textSecondary text-xs uppercase font-semibold tracking-wider">
                  <th className="py-3.5 px-6">Faculty Member</th>
                  <th className="py-3.5 px-6">Department</th>
                  <th className="py-3.5 px-6">Designation</th>
                  <th className="py-3.5 px-6">Assigned Subjects</th>
                  <th className="py-3.5 px-6 text-center">Workload</th>
                  <th className="py-3.5 px-6 text-center">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filteredFaculty.map((f) => {
                  const deptName =
                    f.department?.name ||
                    departments.find((d) => d.id === f.department_id)?.name ||
                    'General Engineering'
                  const initials = (f.name || 'F')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()

                  return (
                    <tr
                      key={f.id}
                      className="hover:bg-background/80 transition-colors group"
                    >
                      {/* Name & Email */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-secondary text-accent font-heading font-bold text-xs flex items-center justify-center border border-border shrink-0">
                            {initials}
                          </div>
                          <div>
                            <span className="font-semibold text-textPrimary block">
                              {f.name}
                            </span>
                            <span className="text-xs text-textSecondary flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3" />
                              {f.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-4 px-6 font-medium text-textPrimary">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <Building className="w-3.5 h-3.5 text-textSecondary" />
                          {deptName}
                        </span>
                      </td>

                      {/* Designation */}
                      <td className="py-4 px-6 text-textSecondary text-xs">
                        <span className="font-medium text-textPrimary block">
                          {f.designation || 'Lecturer'}
                        </span>
                        {f.specialization && (
                          <span className="text-[11px] text-accent">
                            {f.specialization}
                          </span>
                        )}
                      </td>

                      {/* Subjects Chips */}
                      <td className="py-4 px-6 max-w-xs">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {(f.subjects || []).length > 0 ? (
                            f.subjects.slice(0, 3).map((s, idx) => (
                              <span
                                key={idx}
                                className="text-[11px] px-2 py-0.5 rounded-md bg-secondary text-accent font-medium border border-border truncate"
                              >
                                {s.name || s.code || s}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-textSecondary italic">
                              None assigned
                            </span>
                          )}
                          <button
                            onClick={() => handleOpenSubjectAssign(f)}
                            className="p-1 rounded hover:bg-secondary text-textSecondary hover:text-accent transition-colors"
                            title="Assign subjects"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Workload */}
                      <td className="py-4 px-6 text-center font-heading font-bold text-textPrimary">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-background border border-border text-xs">
                          {f.workload_count ?? f.weekly_hours ?? f.substitutions_taken_count ?? 12}h / wk
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6 text-center">
                        <Badge status={f.status || 'ACTIVE'} />
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenProfile(f)}
                            className="p-1.5 rounded-lg text-textSecondary hover:text-accent hover:bg-secondary transition-colors"
                            title="View Faculty Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(f)}
                            className="p-1.5 rounded-lg text-textSecondary hover:text-accent hover:bg-secondary transition-colors"
                            title="Edit Faculty Details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteId(f.id)
                              setIsDeleteOpen(true)
                            }}
                            className="p-1.5 rounded-lg text-textSecondary hover:text-error hover:bg-error/10 transition-colors"
                            title="Delete Faculty"
                          >
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
      </div>

      {/* Add / Edit Faculty Modal */}
      <Modal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        title={editingFaculty ? 'Edit Faculty Details' : 'Add New Faculty Member'}
        subtitle="Ensure institutional credentials and departmental associations are correct."
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAddEditOpen(false)}
              className="btn-ghost text-sm"
              disabled={formSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="faculty-form"
              className="btn-primary text-sm shadow-sm"
              disabled={formSubmitting}
            >
              {formSubmitting
                ? 'Saving...'
                : editingFaculty
                ? 'Update Profile'
                : 'Create Faculty'}
            </button>
          </>
        }
      >
        <form id="faculty-form" onSubmit={handleSaveFaculty} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Dr. Jane Smith"
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="jsmith@syncora.edu"
                className="input-field"
              />
            </div>

            <div>
              <label className="label">
                {editingFaculty ? 'Change Password (optional)' : 'Initial Password'}
              </label>
              <input
                type="password"
                required={!editingFaculty}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={editingFaculty ? 'Leave blank to keep' : '••••••••'}
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Department</label>
              <select
                required
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="input-field"
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || d.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Designation</label>
              <select
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="input-field"
              >
                <option value="Professor">Professor</option>
                <option value="Associate Professor">Associate Professor</option>
                <option value="Assistant Professor">Assistant Professor</option>
                <option value="Lecturer">Lecturer</option>
                <option value="Adjunct Faculty">Adjunct Faculty</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Primary Specialization / Domain</label>
            <input
              type="text"
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              placeholder="e.g. Machine Learning, Distributed Systems, VLSI"
              className="input-field"
            />
          </div>
        </form>
      </Modal>

      {/* Assign Subjects Modal */}
      <Modal
        isOpen={isSubjectsOpen}
        onClose={() => setIsSubjectsOpen(false)}
        title={`Assign Subjects: ${selectedFacultyForSubjects?.name || ''}`}
        subtitle="Select the subjects this faculty member is qualified to teach and cover as substitute."
        maxWidth="max-w-lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsSubjectsOpen(false)}
              className="btn-ghost text-sm"
              disabled={assigningSubjects}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSubjects}
              className="btn-primary text-sm shadow-sm"
              disabled={assigningSubjects}
            >
              {assigningSubjects ? 'Saving...' : 'Save Subjects'}
            </button>
          </>
        }
      >
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {subjects.length === 0 ? (
            <p className="text-xs text-textSecondary py-4 text-center">
              No subjects registered yet. Create subjects in curriculum settings first.
            </p>
          ) : (
            subjects.map((sub) => {
              const isChecked = selectedSubjectIds.includes(sub.id)
              return (
                <label
                  key={sub.id}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-secondary/40 border-primary text-textPrimary'
                      : 'border-border bg-white hover:bg-background'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSubjectIds([...selectedSubjectIds, sub.id])
                        } else {
                          setSelectedSubjectIds(selectedSubjectIds.filter((id) => id !== sub.id))
                        }
                      }}
                      className="rounded text-accent focus:ring-accent w-4 h-4"
                    />
                    <div>
                      <span className="font-medium text-xs text-textPrimary block">
                        {sub.name}
                      </span>
                      <span className="text-[11px] text-textSecondary">
                        Code: {sub.code || 'N/A'} &bull; Dept: {sub.department_code || 'All'}
                      </span>
                    </div>
                  </div>
                  {isChecked && <Check className="w-4 h-4 text-accent" />}
                </label>
              )
            })
          )}
        </div>
      </Modal>

      {/* Profile Details Drawer / Modal */}
      <Modal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        title={profileFaculty?.name || 'Faculty Profile'}
        subtitle={profileFaculty?.designation || 'Academic Profile Details'}
        maxWidth="max-w-2xl"
        footer={
          <button
            type="button"
            onClick={() => setIsProfileOpen(false)}
            className="btn-secondary text-sm"
          >
            Close
          </button>
        }
      >
        {profileFaculty && (
          <div className="space-y-6">
            {/* Faculty Snapshot */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-secondary/30 border border-border">
              <div className="w-14 h-14 rounded-2xl bg-accent text-white font-heading font-bold text-lg flex items-center justify-center shrink-0 shadow-sm">
                {(profileFaculty.name || 'F')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-heading font-bold text-base text-textPrimary">
                    {profileFaculty.name}
                  </h4>
                  <Badge status={profileFaculty.status || 'ACTIVE'} />
                </div>
                <p className="text-xs text-textSecondary mt-0.5">
                  {profileFaculty.email} &bull; {profileFaculty.designation}
                </p>
                <p className="text-xs text-accent font-medium mt-1">
                  Specialization: {profileFaculty.specialization || 'General Academic'}
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-background border border-border text-center">
                <span className="text-[10px] text-textSecondary uppercase font-semibold">Weekly Load</span>
                <p className="font-heading font-bold text-lg text-textPrimary mt-0.5">
                  {profileFaculty.workload_count ?? 14}h
                </p>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border text-center">
                <span className="text-[10px] text-textSecondary uppercase font-semibold">Subs Covered</span>
                <p className="font-heading font-bold text-lg text-success mt-0.5">
                  {profileFaculty.substitutions_count ?? 6}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border text-center">
                <span className="text-[10px] text-textSecondary uppercase font-semibold">Attendance</span>
                <p className="font-heading font-bold text-lg text-accent mt-0.5">
                  98%
                </p>
              </div>
            </div>

            {/* Qualified Subjects */}
            <div>
              <h5 className="font-heading font-semibold text-xs text-textSecondary uppercase tracking-wider mb-2">
                Eligible Teaching Subjects
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {(profileFaculty.subjects || []).length > 0 ? (
                  profileFaculty.subjects.map((s, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2.5 py-1 rounded-lg bg-secondary text-accent font-medium border border-border"
                    >
                      {s.name || s.code || s}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-textSecondary italic">No subjects mapped to this faculty.</p>
                )}
              </div>
            </div>

            {/* Substitution History */}
            <div>
              <h5 className="font-heading font-semibold text-xs text-textSecondary uppercase tracking-wider mb-2">
                Recent Substitution History
              </h5>
              {profileLoading ? (
                <div className="py-4 text-center text-xs text-textSecondary">
                  Loading history logs...
                </div>
              ) : profileHistory?.history?.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {profileHistory.history.map((h, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl border border-border bg-white text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium text-textPrimary">{h.subject}</span>
                        <span className="text-textSecondary ml-2">({h.class_name})</span>
                      </div>
                      <span className="text-[11px] text-textSecondary">{h.date}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-textSecondary italic">
                  No previous substitution events recorded.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Remove Faculty Member"
        message="Are you sure you want to remove this faculty record? This will unlink their assigned timetable classes and historical substitution logs."
        confirmText="Remove Faculty"
        isDestructive={true}
        loading={deleting}
      />
    </div>
  )
}

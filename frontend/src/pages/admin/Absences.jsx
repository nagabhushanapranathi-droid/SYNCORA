import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  UserX,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Search,
  Sparkles,
  Clock,
  History,
  Send,
} from 'lucide-react'
import Badge from '../../components/Badge'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import { absenceService } from '../../services/absenceService'
import { facultyService } from '../../services/facultyService'
import { useToast } from '../../context/ToastContext'

export default function Absences() {
  const [facultyList, setFacultyList] = useState([])
  const [absenceHistory, setAbsenceHistory] = useState([])
  const [loading, setLoading] = useState(true)

  // Report Form state
  const [formData, setFormData] = useState({
    faculty_id: '',
    date: new Date().toISOString().split('T')[0],
    reason: '',
    remarks: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [generatedSubstitutions, setGeneratedSubstitutions] = useState(null)

  // Search faculty in form
  const [facultySearch, setFacultySearch] = useState('')

  const toast = useToast()

  const loadData = async () => {
    setLoading(true)
    try {
      const [facRes, absRes] = await Promise.allSettled([
        facultyService.getAll(),
        absenceService.getAll(),
      ])

      if (facRes.status === 'fulfilled') {
        const facs = Array.isArray(facRes.value) ? facRes.value : facRes.value?.faculty || []
        setFacultyList(facs)
        if (facs.length > 0 && !formData.faculty_id) {
          setFormData((prev) => ({ ...prev, faculty_id: facs[0].id }))
        }
      }

      if (absRes.status === 'fulfilled') {
        const list = Array.isArray(absRes.value) ? absRes.value : absRes.value?.absences || []
        setAbsenceHistory(list)
      }
    } catch {
      toast.error('Failed to load absence records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSubmitAbsence = async (e) => {
    e.preventDefault()
    if (!formData.faculty_id || !formData.date || !formData.reason) {
      toast.warning('Please complete all required fields.')
      return
    }

    setSubmitting(true)
    setGeneratedSubstitutions(null)
    try {
      const response = await absenceService.report(formData)
      toast.success('Absence recorded! AI substitution dispatch created.')

      // Check for generated requests
      const subs =
        response.substitutions ||
        response.generated_substitutions ||
        response.requests ||
        []
      setGeneratedSubstitutions({
        absence: response.absence || response,
        substitutions: subs,
      })

      // Reset reason & remarks
      setFormData((prev) => ({
        ...prev,
        reason: '',
        remarks: '',
      }))

      // Reload history
      const updatedHistory = await absenceService.getAll()
      setAbsenceHistory(Array.isArray(updatedHistory) ? updatedHistory : updatedHistory?.absences || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to file faculty absence.')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredFaculty = facultyList.filter(
    (f) =>
      f.name?.toLowerCase().includes(facultySearch.toLowerCase()) ||
      f.department?.name?.toLowerCase().includes(facultySearch.toLowerCase())
  )

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Two Column Layout: Report Form + Generated Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Report Form */}
        <div className="lg:col-span-7 card">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border mb-6">
            <div className="w-9 h-9 rounded-xl bg-error/10 text-error flex items-center justify-center shrink-0">
              <UserX className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-lg text-textPrimary">
                Report Faculty Absence
              </h2>
              <p className="text-xs text-textSecondary">
                Filing an absence triggers automatic AI candidate evaluation for affected classes.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmitAbsence} className="space-y-4">
            {/* Faculty Search & Selection */}
            <div>
              <label className="label">Select Absent Faculty Member *</label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-textSecondary" />
                  <input
                    type="text"
                    placeholder="Type to filter faculty..."
                    value={facultySearch}
                    onChange={(e) => setFacultySearch(e.target.value)}
                    className="input-field pl-9 text-xs"
                  />
                </div>
                <select
                  required
                  value={formData.faculty_id}
                  onChange={(e) => setFormData({ ...formData, faculty_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">-- Choose Faculty Member --</option>
                  {filteredFaculty.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.department?.code || f.department?.name || 'Faculty'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date Picker */}
            <div>
              <label className="label">Date of Absence *</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="label">Primary Reason *</label>
              <input
                type="text"
                required
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="e.g. Medical Leave, Academic Conference, Personal Emergency"
                className="input-field"
              />
            </div>

            {/* Remarks */}
            <div>
              <label className="label">Administrative Remarks & Handover Notes</label>
              <textarea
                rows={3}
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Provide any instructions, chapter notes, or specific instructions for substitutes..."
                className="input-field"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-2.5 shadow-sm inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing Timetable & Generating Coverage...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Log Absence & Generate Substitutions
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-5 card flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-border mb-4">
              <Sparkles className="w-4 h-4 text-accent" />
              <h3 className="font-heading font-bold text-base text-textPrimary">
                Generated Substitution Coverage
              </h3>
            </div>

            {generatedSubstitutions ? (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="p-3.5 rounded-xl bg-success/10 border border-success/20 flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <div>
                    <span className="font-heading font-bold text-xs text-success block">
                      Absence successfully registered
                    </span>
                    <p className="text-xs text-textSecondary mt-0.5">
                      SYNCORA has parsed the affected periods and ranked available faculty.
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <span className="text-xs font-semibold text-textSecondary uppercase tracking-wider block">
                    Generated Substitution Requests:
                  </span>
                  {generatedSubstitutions.substitutions.length === 0 ? (
                    <p className="text-xs text-textSecondary italic p-4 rounded-xl bg-background border border-border text-center">
                      No scheduled teaching classes found for this faculty on this date.
                    </p>
                  ) : (
                    generatedSubstitutions.substitutions.map((sub, idx) => (
                      <div
                        key={sub.id || idx}
                        className="p-3.5 rounded-xl border border-border bg-white shadow-sm flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-xs text-textPrimary">
                              {sub.subject_name || sub.subject || 'Core Subject'}
                            </span>
                            <Badge status={sub.status || 'RECOMMENDED'} />
                          </div>
                          <p className="text-[11px] text-textSecondary mt-1">
                            Slot: {sub.time_slot || 'Period'} &bull; Match:{' '}
                            <span className="text-accent font-semibold">
                              {sub.recommended_substitute_name || sub.recommended_substitute || 'Optimal Match'}
                            </span>
                          </p>
                        </div>
                        <Link
                          to={`/admin/substitutions?id=${sub.id}`}
                          className="btn-secondary text-xs py-1 px-2.5"
                        >
                          Review
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-secondary text-accent flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 stroke-[1.8]" />
                </div>
                <h4 className="font-heading font-semibold text-sm text-textPrimary">
                  Awaiting Absence Submission
                </h4>
                <p className="text-xs text-textSecondary max-w-xs mx-auto mt-1">
                  Once you file an absence on the left, the system immediately outputs the affected teaching slots and optimal substitutes here.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border mt-4 text-center">
            <Link
              to="/admin/substitutions"
              className="text-xs font-medium text-accent hover:underline inline-flex items-center gap-1"
            >
              Go to Substitution Queue <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Absence History Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-accent" />
            <h3 className="font-heading font-bold text-base text-textPrimary">
              Absence History & Logs
            </h3>
          </div>
          <span className="text-xs text-textSecondary">
            {absenceHistory.length} Total Records
          </span>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <LoadingSpinner message="Loading historical absence data..." />
          </div>
        ) : absenceHistory.length === 0 ? (
          <EmptyState
            icon={UserX}
            title="No past absence records"
            description="All faculty members have had perfect recorded attendance so far."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/30 text-textSecondary text-xs uppercase font-semibold tracking-wider">
                  <th className="py-3.5 px-6">Faculty Member</th>
                  <th className="py-3.5 px-6">Date of Absence</th>
                  <th className="py-3.5 px-6">Reason Given</th>
                  <th className="py-3.5 px-6 text-center">Substitutions Generated</th>
                  <th className="py-3.5 px-6">Reported By</th>
                  <th className="py-3.5 px-6 text-right">Date Reported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {absenceHistory.map((abs) => {
                  const facName = abs.faculty_name || abs.faculty?.name || 'Faculty Member'
                  const slots = abs.substitutions_count || abs.slots_count || 1

                  return (
                    <tr key={abs.id} className="hover:bg-background/80 transition-colors">
                      <td className="py-4 px-6 font-semibold text-textPrimary">
                        {facName}
                      </td>
                      <td className="py-4 px-6 text-xs text-textSecondary font-mono">
                        {abs.date}
                      </td>
                      <td className="py-4 px-6 text-xs text-textPrimary max-w-xs truncate">
                        {abs.reason || 'Medical Leave'}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-accent">
                          {slots} slot{slots > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-xs text-textSecondary">
                        {abs.reported_by || 'Administrator'}
                      </td>
                      <td className="py-4 px-6 text-xs text-textSecondary text-right">
                        {abs.created_at ? abs.created_at.substring(0, 10) : abs.date}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

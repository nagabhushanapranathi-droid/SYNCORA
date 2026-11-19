import { useState, useEffect, useMemo } from 'react'
import {
  CalendarDays,
  Clock,
  Sparkles,
  BookOpen,
  MapPin,
  Users,
  Info,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/Modal'
import LoadingSpinner from '../../components/LoadingSpinner'
import { timetableService } from '../../services/timetableService'
import { substitutionService } from '../../services/substitutionService'
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

export default function FacultyTimetable() {
  const { user } = useAuth()
  const [timetableEntries, setTimetableEntries] = useState([])
  const [substitutionEntries, setSubstitutionEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewSlot, setViewSlot] = useState(null)

  const toast = useToast()

  const loadSchedule = async () => {
    setLoading(true)
    try {
      const [ttRes, subRes] = await Promise.allSettled([
        timetableService.getAll({ faculty_id: user?.id }),
        substitutionService.getAll({ substitute_id: user?.id }),
      ])

      if (ttRes.status === 'fulfilled') {
        const list = Array.isArray(ttRes.value) ? ttRes.value : ttRes.value?.timetable || []
        setTimetableEntries(list)
      }

      if (subRes.status === 'fulfilled') {
        const subs = Array.isArray(subRes.value) ? subRes.value : subRes.value?.substitutions || []
        setSubstitutionEntries(subs)
      }
    } catch {
      toast.error('Failed to load your personal weekly schedule.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSchedule()
  }, [user])

  // Lookup map: `${day}_${timeSlot}` -> entry
  const timetableMap = useMemo(() => {
    const map = {}

    // First map regular timetable classes
    timetableEntries.forEach((entry) => {
      const day = (entry.day || '').toUpperCase()
      const slot = entry.time_slot || `${entry.start_time || '09:00'} - ${entry.end_time || '10:00'}`
      const matchingSlot = TIME_SLOTS.find(
        (ts) => ts === slot || slot.startsWith(ts.split(' - ')[0])
      ) || slot

      map[`${day}_${matchingSlot}`] = {
        ...entry,
        isRegular: true,
      }
    })

    // Layer active substitution assignments
    substitutionEntries.forEach((sub) => {
      if ((sub.status || '').toUpperCase() !== 'REJECTED') {
        const day = (sub.day || 'MONDAY').toUpperCase()
        const slot = sub.time_slot || '09:00 - 10:00'
        const matchingSlot = TIME_SLOTS.find(
          (ts) => ts === slot || slot.startsWith(ts.split(' - ')[0])
        ) || slot

        map[`${day}_${matchingSlot}`] = {
          ...sub,
          isSubstitution: true,
        }
      }
    })

    return map
  }, [timetableEntries, substitutionEntries])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Legend */}
      <div className="card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-bold text-lg text-textPrimary">
            My Teaching Schedule (Weekly Grid)
          </h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Synchronized schedule showing regular teaching duties and active substitution assignments.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-medium text-textSecondary">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#F7DCE5] border border-[#E8A0B4]" />
            Regular Class
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#EBE9F8] border border-[#8B84C4]" />
            Assigned Substitution
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#FCE8EA] border border-[#C0616A]" />
            Suspended
          </span>
        </div>
      </div>

      {/* Timetable Weekly Matrix */}
      <div className="card !p-0 overflow-hidden shadow-card">
        {loading ? (
          <div className="py-24 flex justify-center">
            <LoadingSpinner message="Building your weekly teaching matrix..." />
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
                            className="p-2 border-r border-border last:border-r-0 text-center align-top"
                          >
                            <div className="w-full h-16 rounded-xl border border-dashed border-border/60 flex items-center justify-center text-[11px] text-textSecondary/40 select-none">
                              Free
                            </div>
                          </td>
                        )
                      }

                      const isSub = Boolean(entry.isSubstitution || entry.is_substitution)
                      const isSuspended = (entry.status || '').toUpperCase() === 'SUSPENDED'

                      let chipStyle = 'bg-[#F7DCE5] text-accent border-[#E8A0B4] hover:bg-[#F3CAD6]'
                      if (isSub) {
                        chipStyle = 'bg-[#EBE9F8] text-info border-[#8B84C4] hover:bg-[#E0DCF4]'
                      } else if (isSuspended) {
                        chipStyle = 'bg-[#FCE8EA] text-error border-[#C0616A] line-through opacity-80'
                      }

                      return (
                        <td
                          key={key}
                          className="p-2 border-r border-border last:border-r-0 align-top"
                        >
                          <div
                            onClick={() => setViewSlot(entry)}
                            className={`p-2.5 rounded-xl border cursor-pointer transition-all shadow-sm ${chipStyle} text-left flex flex-col justify-between min-h-[72px]`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-heading font-bold text-xs truncate leading-tight">
                                  {entry.subject_name || entry.subject?.name || entry.subject || 'Class Subject'}
                                </span>
                                {isSub && (
                                  <span className="text-[9px] font-bold uppercase bg-info/20 text-info px-1 rounded shrink-0">
                                    SUB
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-medium opacity-90 block mt-0.5 truncate">
                                {isSub
                                  ? `Covering: ${entry.absent_faculty_name || 'Absent Staff'}`
                                  : entry.class_name || 'Cohort'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[10px] opacity-80 mt-1.5 pt-1 border-current/10 border-t">
                              <span>{entry.classroom || 'Lab Room'}</span>
                              <span>{entry.section ? `Sec ${entry.section}` : 'Standard'}</span>
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

      {/* Class Details Modal */}
      <Modal
        isOpen={Boolean(viewSlot)}
        onClose={() => setViewSlot(null)}
        title={viewSlot?.subject_name || viewSlot?.subject?.name || viewSlot?.subject || 'Class Details'}
        subtitle={`${viewSlot?.day || ''} &bull; ${viewSlot?.time_slot || ''}`}
        footer={
          <button
            type="button"
            onClick={() => setViewSlot(null)}
            className="btn-secondary text-xs"
          >
            Close
          </button>
        }
      >
        {viewSlot && (
          <div className="space-y-4 text-sm">
            <div className="p-4 rounded-xl bg-secondary/30 border border-border flex items-center justify-between">
              <div>
                <span className="text-xs text-textSecondary uppercase font-medium">Classroom Allocation</span>
                <p className="font-heading font-bold text-base text-textPrimary mt-0.5">
                  {viewSlot.classroom || 'Classroom Hall'}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/15 text-accent">
                {viewSlot.isSubstitution ? 'Substitution Duty' : 'Regular Class'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-border bg-white">
                <span className="text-textSecondary block">Target Cohort</span>
                <span className="font-semibold text-textPrimary mt-1 block">
                  {viewSlot.class_name || 'Standard Cohort'} (Sec {viewSlot.section || 'A'})
                </span>
              </div>
              <div className="p-3 rounded-xl border border-border bg-white">
                <span className="text-textSecondary block">Scheduled Time</span>
                <span className="font-semibold text-textPrimary mt-1 block font-mono">
                  {viewSlot.time_slot || `${viewSlot.start_time} - ${viewSlot.end_time}`}
                </span>
              </div>
            </div>

            {viewSlot.isSubstitution && (
              <div className="p-3.5 rounded-xl bg-info/10 border border-info/20 text-xs text-info flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Substitution Details:</strong>
                  <span>
                    You have been assigned to cover this period for{' '}
                    <strong>{viewSlot.absent_faculty_name || 'your colleague'}</strong>. Please proceed to the assigned lecture hall on time.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

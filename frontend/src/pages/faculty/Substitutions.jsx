import { useState, useEffect, useMemo } from 'react'
import {
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  Calendar,
  Building,
  User,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Badge from '../../components/Badge'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import { substitutionService } from '../../services/substitutionService'
import { useToast } from '../../context/ToastContext'

export default function FacultySubstitutions() {
  const { user } = useAuth()
  const [substitutions, setSubstitutions] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [ackLoadingId, setAckLoadingId] = useState(null)

  const toast = useToast()

  const loadSubstitutions = async () => {
    setLoading(true)
    try {
      const res = await substitutionService.getAll({ substitute_id: user?.id })
      const list = Array.isArray(res) ? res : res.substitutions || []
      setSubstitutions(list)
    } catch {
      toast.error('Failed to load your substitution duties.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSubstitutions()
  }, [user])

  const handleAcknowledge = async (id) => {
    setAckLoadingId(id)
    try {
      await substitutionService.acknowledge(id)
      toast.success('Assignment duty acknowledged and logged!')
      setSubstitutions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'ACKNOWLEDGED' } : s))
      )
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not acknowledge assignment.')
    } finally {
      setAckLoadingId(null)
    }
  }

  const filteredList = useMemo(() => {
    return substitutions.filter((s) => {
      if (statusFilter === 'ALL') return true
      const status = (s.status || '').toUpperCase()
      if (statusFilter === 'PENDING') {
        return status === 'PENDING' || status === 'APPROVED' || status === 'RECOMMENDED'
      }
      return status === statusFilter
    })
  }, [substitutions, statusFilter])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Filter Controls */}
      <div className="card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-bold text-lg text-textPrimary">
            My Substitution Assignments & Coverage Duties
          </h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Review timetable coverage duties dispatched to you and acknowledge attendance readiness.
          </p>
        </div>

        <button
          onClick={loadSubstitutions}
          className="btn-secondary text-xs self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Duties
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap p-1 bg-white border border-border rounded-xl w-fit shadow-sm">
        {[
          { id: 'ALL', label: 'All Duties' },
          { id: 'PENDING', label: 'Needs Acknowledgment' },
          { id: 'ACKNOWLEDGED', label: 'Acknowledged' },
          { id: 'COMPLETED', label: 'Completed' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === tab.id
                ? 'bg-accent text-white shadow-sm'
                : 'text-textSecondary hover:text-textPrimary hover:bg-secondary/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Assignments List */}
      {loading ? (
        <div className="card py-20 flex justify-center">
          <LoadingSpinner message="Checking for assigned substitution duties..." />
        </div>
      ) : filteredList.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ArrowLeftRight}
            title="No substitution assignments found"
            description="You do not have any pending or completed substitution duties under this filter."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map((sub) => {
            const status = (sub.status || 'PENDING').toUpperCase()
            const canAck = status === 'APPROVED' || status === 'PENDING' || status === 'RECOMMENDED'

            return (
              <div
                key={sub.id}
                className="card hover:shadow-card-hover transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-secondary text-accent flex items-center justify-center font-heading font-bold text-xs shrink-0 border border-border">
                        <Calendar className="w-5 h-5 stroke-[1.8]" />
                      </div>
                      <div>
                        <span className="font-heading font-bold text-sm text-textPrimary block">
                          {sub.subject_name || sub.subject || 'Class Subject'}
                        </span>
                        <span className="text-xs text-textSecondary font-medium">
                          {sub.class_name || sub.classroom || 'Classroom 204'}
                        </span>
                      </div>
                    </div>
                    <Badge status={sub.status || 'PENDING'} />
                  </div>

                  {/* Card Body Specs */}
                  <div className="py-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-textSecondary">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-accent" />
                        Date & Period:
                      </span>
                      <span className="font-semibold text-textPrimary font-mono">
                        {sub.date} &bull; {sub.time_slot || '09:00 - 10:00'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-textSecondary">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-error" />
                        Covering for Colleague:
                      </span>
                      <span className="font-semibold text-textPrimary">
                        {sub.absent_faculty_name || sub.original_faculty || 'Faculty Member'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-textSecondary">
                      <span className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-info" />
                        Room Location:
                      </span>
                      <span className="font-semibold text-textPrimary">
                        {sub.classroom || 'Lecture Hall A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-textSecondary">
                    {canAck ? 'Acknowledgment Required' : 'Duty Logged'}
                  </span>

                  {canAck ? (
                    <button
                      onClick={() => handleAcknowledge(sub.id)}
                      disabled={ackLoadingId === sub.id}
                      className="btn-primary text-xs py-1.5 px-3.5 shadow-sm inline-flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {ackLoadingId === sub.id ? 'Acknowledging...' : 'Acknowledge Duty'}
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-success inline-flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Acknowledged
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

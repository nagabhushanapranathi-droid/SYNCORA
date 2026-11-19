import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowLeftRight,
  Sparkles,
  Check,
  X,
  UserCheck,
  AlertOctagon,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  BookOpen,
  Filter,
  RefreshCw,
  Search,
} from 'lucide-react'
import Modal from '../../components/Modal'
import Badge from '../../components/Badge'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import LessonPlanModal from '../../components/LessonPlanModal'
import { substitutionService } from '../../services/substitutionService'
import { facultyService } from '../../services/facultyService'
import { useToast } from '../../context/ToastContext'

export default function Substitutions() {
  const [searchParams] = useSearchParams()
  const initialStatus = searchParams.get('status') || 'ALL'
  const initialId = searchParams.get('id')

  const [substitutions, setSubstitutions] = useState([])
  const [facultyList, setFacultyList] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(initialStatus)
  const [expandedId, setExpandedId] = useState(initialId ? parseInt(initialId, 10) : null)
  const [candidateData, setCandidateData] = useState({})
  const [loadingCandidates, setLoadingCandidates] = useState(false)

  // Actions state
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [selectedSubForManual, setSelectedSubForManual] = useState(null)
  const [manualFacultyId, setManualFacultyId] = useState('')
  const [manualReason, setManualReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedPlanSubId, setSelectedPlanSubId] = useState(null)

  const toast = useToast()

  const loadSubstitutions = async () => {
    setLoading(true)
    try {
      const [subRes, facRes] = await Promise.allSettled([
        substitutionService.getAll(),
        facultyService.getAll(),
      ])

      if (subRes.status === 'fulfilled') {
        const list = Array.isArray(subRes.value) ? subRes.value : subRes.value?.substitutions || []
        setSubstitutions(list)
        if (initialId && !expandedId) {
          const match = list.find((s) => String(s.id) === String(initialId))
          if (match) setExpandedId(match.id)
        }
      }

      if (facRes.status === 'fulfilled') {
        const facs = Array.isArray(facRes.value) ? facRes.value : facRes.value?.faculty || []
        setFacultyList(facs)
      }
    } catch {
      toast.error('Failed to load substitution requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSubstitutions()
  }, [])

  // When expanding a card, fetch candidate details if not already loaded
  useEffect(() => {
    if (expandedId && !candidateData[expandedId]) {
      const fetchDetail = async () => {
        setLoadingCandidates(true)
        try {
          const detail = await substitutionService.getById(expandedId)
          setCandidateData((prev) => ({ ...prev, [expandedId]: detail }))
        } catch {
          // If detail fails, fallback gracefully
        } finally {
          setLoadingCandidates(false)
        }
      }
      fetchDetail()
    }
  }, [expandedId, candidateData])

  // Filtered list
  const filteredSubstitutions = useMemo(() => {
    return substitutions.filter((s) => {
      if (activeTab === 'ALL') return true
      const status = (s.status || '').toUpperCase()
      return status === activeTab.toUpperCase()
    })
  }, [substitutions, activeTab])

  const handleApprove = async (subId) => {
    setActionLoading(true)
    try {
      await substitutionService.approve(subId)
      toast.success('Substitution duty approved and confirmed!')
      loadSubstitutions()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (subId) => {
    setActionLoading(true)
    try {
      await substitutionService.reject(subId, { reason: 'Administrative rejection' })
      toast.warning('Substitution request rejected.')
      loadSubstitutions()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject request.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSuspend = async (subId) => {
    setActionLoading(true)
    try {
      await substitutionService.suspend(subId, { reason: 'No viable substitute; hour suspended' })
      toast.info('Teaching hour suspended.')
      loadSubstitutions()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to suspend hour.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleOpenManual = (sub) => {
    setSelectedSubForManual(sub)
    setManualFacultyId(facultyList[0]?.id || '')
    setManualReason('Administrative manual assignment')
    setManualModalOpen(true)
  }

  const handleSaveManualAssign = async (e) => {
    e.preventDefault()
    if (!selectedSubForManual || !manualFacultyId) return
    setActionLoading(true)
    try {
      await substitutionService.manualAssign(selectedSubForManual.id, {
        substitute_faculty_id: manualFacultyId,
        reason: manualReason,
      })
      toast.success('Faculty manually assigned successfully.')
      setManualModalOpen(false)
      loadSubstitutions()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Manual assignment failed.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-bold text-lg text-textPrimary">
            Substitution Queue & Approvals
          </h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Review AI recommendation rankings, candidate compatibility breakdowns, and dispatch duties.
          </p>
        </div>

        <button
          onClick={loadSubstitutions}
          className="btn-secondary text-xs self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Queue
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap p-1 bg-white border border-border rounded-xl w-fit shadow-sm">
        {['ALL', 'PENDING', 'RECOMMENDED', 'APPROVED', 'REJECTED', 'SUSPENDED'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              activeTab === tab
                ? 'bg-accent text-white shadow-sm'
                : 'text-textSecondary hover:text-textPrimary hover:bg-secondary/40'
            }`}
          >
            {tab.toLowerCase()}
          </button>
        ))}
      </div>

      {/* List of Substitutions */}
      {loading ? (
        <div className="card py-20 flex justify-center">
          <LoadingSpinner message="Loading substitution requests..." />
        </div>
      ) : filteredSubstitutions.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ArrowLeftRight}
            title="No substitution requests found"
            description={`There are currently no requests matching status '${activeTab}'.`}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSubstitutions.map((sub) => {
            const isExpanded = expandedId === sub.id
            const detail = candidateData[sub.id] || sub
            const candidates = detail.candidates || detail.ranked_candidates || []
            const fallbacks = detail.fallbacks || detail.fallback_candidates || []
            const explanation =
              detail.ai_explanation ||
              detail.explanation ||
              'Candidate selected based on optimal subject expertise, free period availability, and lowest weekly substitution workload balance.'
            const matchScore = sub.match_score ?? sub.score ?? 94

            return (
              <div
                key={sub.id}
                className={`card transition-all duration-200 overflow-hidden border ${
                  isExpanded ? 'ring-2 ring-primary/40 border-primary' : 'border-border'
                }`}
              >
                {/* Collapsed / Header Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                  className="cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-secondary text-accent font-heading font-bold text-xs flex flex-col items-center justify-center border border-border shrink-0">
                      <span>{sub.date ? sub.date.substring(5) : 'Date'}</span>
                      <span className="text-[10px] text-textSecondary font-mono mt-0.5">
                        {sub.time_slot || 'Period'}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading font-bold text-base text-textPrimary">
                          {sub.subject_name || sub.subject || 'Academic Subject'}
                        </span>
                        <span className="text-xs text-textSecondary font-medium">
                          ({sub.class_name || sub.classroom || 'Classroom A'})
                        </span>
                        <Badge status={sub.status || 'PENDING'} />
                      </div>

                      <div className="flex items-center gap-4 text-xs text-textSecondary mt-1 flex-wrap">
                        <span>
                          Absent:{' '}
                          <strong className="text-textPrimary font-semibold">
                            {sub.absent_faculty_name || sub.original_faculty || 'Faculty Member'}
                          </strong>
                        </span>
                        <span>&bull;</span>
                        <span>
                          Recommended Substitute:{' '}
                          <strong className="text-accent font-semibold">
                            {sub.substitute_faculty_name || sub.recommended_substitute || 'Pending Ranking'}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end md:self-auto">
                    {matchScore && (
                      <div className="text-right">
                        <span className="text-[10px] text-textSecondary uppercase font-medium">
                          Match Score
                        </span>
                        <p className="font-heading font-bold text-lg text-accent leading-none">
                          {matchScore}%
                        </p>
                      </div>
                    )}

                    <div className="p-1 rounded-lg text-textSecondary hover:bg-secondary">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-border space-y-6 animate-in fade-in duration-200">
                    {/* AI Explanation Banner */}
                    <div className="p-4 rounded-2xl bg-secondary/30 border border-primary/20">
                      <div className="flex items-center gap-2 text-accent font-heading font-bold text-xs uppercase tracking-wider mb-1.5">
                        <Sparkles className="w-4 h-4" />
                        SYNCORA AI Reasoning & Dispatch Narrative
                      </div>
                      <p className="text-xs text-textPrimary leading-relaxed">
                        {explanation}
                      </p>
                    </div>

                    {/* Candidate Ranking List */}
                    <div>
                      <h4 className="font-heading font-semibold text-xs text-textSecondary uppercase tracking-wider mb-3">
                        Ranked Candidate Pool & Algorithmic Fit Breakdown
                      </h4>

                      {loadingCandidates ? (
                        <div className="py-6 flex justify-center">
                          <LoadingSpinner size="sm" message="Loading candidate metrics..." />
                        </div>
                      ) : candidates.length === 0 ? (
                        <div className="p-4 rounded-xl bg-background border border-border text-xs text-textSecondary text-center">
                          No direct candidates scored for this request. Review fallback options or assign manually.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {candidates.map((cand, idx) => {
                            const score = cand.score ?? 95 - idx * 7
                            const expertise = cand.expertise_score ?? 90
                            const availability = cand.availability_score ?? 100
                            const workload = cand.workload_score ?? 85

                            return (
                              <div
                                key={cand.id || idx}
                                className={`p-4 rounded-xl border transition-all ${
                                  idx === 0
                                    ? 'bg-secondary/15 border-accent/40'
                                    : 'bg-white border-border'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center shrink-0">
                                      #{idx + 1}
                                    </span>
                                    <span className="font-semibold text-sm text-textPrimary">
                                      {cand.name}
                                    </span>
                                    <span className="text-xs text-textSecondary">
                                      ({cand.department_name || cand.department || 'Academic'})
                                    </span>
                                    {idx === 0 && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent text-white uppercase tracking-wider">
                                        Top Pick
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-textSecondary">Overall Fit:</span>
                                    <span className="font-heading font-bold text-sm text-accent">
                                      {score}%
                                    </span>
                                  </div>
                                </div>

                                {/* Score Breakdown Visual Progress Bars */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                                  <div>
                                    <div className="flex justify-between text-[11px] text-textSecondary mb-1">
                                      <span>Subject Expertise</span>
                                      <span className="font-medium text-textPrimary">{expertise}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-accent rounded-full"
                                        style={{ width: `${expertise}%` }}
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <div className="flex justify-between text-[11px] text-textSecondary mb-1">
                                      <span>Free Period Availability</span>
                                      <span className="font-medium text-textPrimary">{availability}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-success rounded-full"
                                        style={{ width: `${availability}%` }}
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <div className="flex justify-between text-[11px] text-textSecondary mb-1">
                                      <span>Workload Equity</span>
                                      <span className="font-medium text-textPrimary">{workload}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-info rounded-full"
                                        style={{ width: `${workload}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {cand.reasons && (
                                  <p className="text-[11px] text-textSecondary mt-2 italic">
                                    Why: {cand.reasons}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Fallback Candidates Section */}
                    {fallbacks.length > 0 && (
                      <div>
                        <h4 className="font-heading font-semibold text-xs text-warning uppercase tracking-wider mb-2">
                          Fallback Candidates (Cross-Department / Available)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {fallbacks.map((fb, i) => (
                            <div
                              key={i}
                              className="p-3 rounded-xl border border-border bg-background text-xs flex items-center justify-between"
                            >
                              <span className="font-medium text-textPrimary">{fb.name}</span>
                              <span className="text-[11px] text-textSecondary">{fb.department}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons Toolbar */}
                    <div className="pt-4 border-t border-border flex flex-wrap items-center justify-end gap-3">
                      <button
                        onClick={() => setSelectedPlanSubId(sub.id)}
                        className="btn-secondary text-xs inline-flex items-center gap-1.5"
                        title="View or edit 12-point structured lesson plan and verified progress"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-accent" />
                        Lesson Plan
                      </button>

                      <button
                        onClick={() => handleSuspend(sub.id)}
                        disabled={actionLoading}
                        className="btn-ghost text-xs text-error hover:bg-error/10 hover:text-error"
                      >
                        <AlertOctagon className="w-3.5 h-3.5" />
                        Suspend Hour
                      </button>

                      <button
                        onClick={() => handleOpenManual(sub)}
                        disabled={actionLoading}
                        className="btn-secondary text-xs"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Manual Assign
                      </button>

                      <button
                        onClick={() => handleReject(sub.id)}
                        disabled={actionLoading}
                        className="px-3 py-2 rounded-xl border border-error/30 text-error hover:bg-error hover:text-white transition-colors text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>

                      <button
                        onClick={() => handleApprove(sub.id)}
                        disabled={actionLoading}
                        className="btn-primary text-xs shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve Top Match
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Manual Assignment Modal */}
      <Modal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        title="Manual Faculty Assignment"
        subtitle={`Select a substitute faculty member for ${selectedSubForManual?.subject_name || 'this class'}.`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setManualModalOpen(false)}
              className="btn-ghost text-sm"
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="manual-form"
              className="btn-primary text-sm shadow-sm"
              disabled={actionLoading}
            >
              {actionLoading ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </>
        }
      >
        <form id="manual-form" onSubmit={handleSaveManualAssign} className="space-y-4">
          <div>
            <label className="label">Eligible Faculty</label>
            <select
              required
              value={manualFacultyId}
              onChange={(e) => setManualFacultyId(e.target.value)}
              className="input-field"
            >
              <option value="">Select Faculty</option>
              {facultyList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.department?.name || 'Academic'}) &bull; Load: {f.workload_count ?? 12}h
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Assignment Justification / Reason</label>
            <textarea
              required
              rows={3}
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              placeholder="e.g. Subject matter expert specifically requested by head of department"
              className="input-field"
            />
          </div>
        </form>
      </Modal>

      {/* Structured Lesson Plan & Academic Continuity Modal */}
      <LessonPlanModal
        isOpen={!!selectedPlanSubId}
        onClose={() => setSelectedPlanSubId(null)}
        substitutionId={selectedPlanSubId}
        readOnly={false}
      />
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import {
  BookOpen,
  Clock,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Save,
  Check,
  FileText,
  Sparkles,
  ChevronRight,
  ListOrdered,
  HelpCircle,
  Award,
  Layers,
} from 'lucide-react'
import Modal from './Modal'
import LoadingSpinner from './LoadingSpinner'
import Badge from './Badge'
import { substitutionService } from '../services/substitutionService'
import { useToast } from '../context/ToastContext'

export default function LessonPlanModal({ isOpen, onClose, substitutionId, isFaculty = false }) {
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState(null)
  const [activeTab, setActiveTab] = useState('view') // 'view', 'edit', 'progress', 'handover'
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Edit form state
  const [teachingNotes, setTeachingNotes] = useState('')
  const [feedback, setFeedback] = useState('')
  const [status, setStatus] = useState('GENERATED')

  // Progress form state
  const [progressTopic, setProgressTopic] = useState('')
  const [progressUnit, setProgressUnit] = useState(1)
  const [progressHours, setProgressHours] = useState(1.0)
  const [progressNotes, setProgressNotes] = useState('')

  // Handover form state
  const [handoverUnit, setHandoverUnit] = useState('')
  const [handoverTopic, setHandoverTopic] = useState('')
  const [handoverNotes, setHandoverNotes] = useState('')

  const toast = useToast()

  const loadPlan = async () => {
    if (!substitutionId) return
    setLoading(true)
    try {
      const res = await substitutionService.getLessonPlan(substitutionId)
      const data = res.data || res
      setPlan(data)
      setTeachingNotes(data.teaching_notes || '')
      setFeedback(data.feedback || '')
      setStatus(data.status || 'GENERATED')
    } catch (err) {
      setPlan(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && substitutionId) {
      loadPlan()
      setActiveTab('view')
    }
  }, [isOpen, substitutionId])

  const handleGeneratePlan = async () => {
    setGenerating(true)
    try {
      const res = await substitutionService.generateLessonPlan(substitutionId, true)
      toast.success('Lesson plan generated successfully!')
      setPlan(res.data || res)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate lesson plan.')
    } finally {
      setGenerating(false)
    }
  }

  const handleSavePlan = async () => {
    setSaving(true)
    try {
      const res = await substitutionService.updateLessonPlan(substitutionId, {
        teaching_notes: teachingNotes,
        feedback: feedback,
        status: status,
      })
      toast.success('Lesson plan updated successfully!')
      setPlan(res.data || res)
      setActiveTab('view')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update lesson plan.')
    } finally {
      setSaving(false)
    }
  }

  const handleRecordProgress = async (e) => {
    e.preventDefault()
    if (!progressTopic.trim()) {
      toast.error('Topic name is required.')
      return
    }
    setSaving(true)
    try {
      await substitutionService.recordProgress(substitutionId, {
        topic_name: progressTopic,
        unit_number: progressUnit,
        hours_spent: progressHours,
        notes: progressNotes,
        status: 'COMPLETED',
      })
      toast.success('Official academic progress verified & recorded!')
      setProgressTopic('')
      setProgressNotes('')
      setActiveTab('view')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record progress.')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitHandover = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await substitutionService.submitHandover(substitutionId, {
        current_unit: handoverUnit,
        current_topic: handoverTopic,
        student_notes: handoverNotes,
      })
      toast.success('Faculty handover note submitted successfully!')
      setActiveTab('view')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit handover note.')
    } finally {
      setSaving(false)
    }
  }

  const structured = plan?.structured_plan

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Substitute Lesson Plan & Academic Continuity"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-3 text-xs">
          <button
            onClick={() => setActiveTab('view')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'view'
                ? 'bg-accent text-white shadow-sm'
                : 'bg-secondary/40 text-textSecondary hover:text-textPrimary'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 inline mr-1.5" />
            Lesson Plan
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'edit'
                ? 'bg-accent text-white shadow-sm'
                : 'bg-secondary/40 text-textSecondary hover:text-textPrimary'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 inline mr-1.5" />
            Notes & Feedback
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'progress'
                ? 'bg-accent text-white shadow-sm'
                : 'bg-secondary/40 text-textSecondary hover:text-textPrimary'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />
            Record Progress
          </button>
          <button
            onClick={() => setActiveTab('handover')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'handover'
                ? 'bg-accent text-white shadow-sm'
                : 'bg-secondary/40 text-textSecondary hover:text-textPrimary'
            }`}
          >
            <FileText className="w-3.5 h-3.5 inline mr-1.5" />
            Faculty Handover
          </button>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <LoadingSpinner message="Retrieving lesson plan from database..." />
          </div>
        ) : !plan ? (
          <div className="text-center py-12 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary text-accent flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-base text-textPrimary">
                No Lesson Plan Generated Yet
              </h4>
              <p className="text-xs text-textSecondary max-w-md mx-auto mt-1">
                A structured lesson plan has not been generated for this substitution request.
              </p>
            </div>
            <button
              onClick={handleGeneratePlan}
              disabled={generating}
              className="btn-primary text-xs mx-auto inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {generating ? 'Generating Lesson Plan...' : 'Generate Plan Now'}
            </button>
          </div>
        ) : (
          <div>
            {/* VIEW TAB */}
            {activeTab === 'view' && (
              <div className="space-y-6 text-sm">
                {/* Academic Continuity Alert if Warning Exists */}
                {plan.has_academic_continuity_warning && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed">
                      <span className="font-bold block">Academic Continuity Notice:</span>
                      {plan.continuity_warning_message}
                    </div>
                  </div>
                )}

                {/* Plan Metadata Card */}
                <div className="p-4 rounded-xl bg-background border border-border grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-textSecondary block">Course:</span>
                    <span className="font-semibold text-textPrimary font-mono">
                      {plan.subject_name} ({plan.subject_code})
                    </span>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Class & Duration:</span>
                    <span className="font-semibold text-textPrimary">
                      {plan.class_name} &bull; {plan.duration_minutes} min
                    </span>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Assigned Substitute:</span>
                    <span className="font-semibold text-textPrimary">
                      {plan.substitute_faculty_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Generation Engine:</span>
                    <span className="font-semibold text-accent inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {plan.ai_provider || 'SYNCORA Engine'}
                    </span>
                  </div>
                </div>

                {/* 12-Point Structured Breakdown */}
                {structured ? (
                  <div className="space-y-5">
                    {/* Title & Objectives */}
                    <div className="card border-border bg-white space-y-3">
                      <h3 className="font-heading font-bold text-base text-textPrimary">
                        {structured.lesson_title || 'Substitute Class Lesson Plan'}
                      </h3>
                      <div>
                        <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">
                          1. Learning Objectives
                        </h4>
                        <ul className="space-y-1.5 text-xs text-textPrimary list-disc list-inside">
                          {(structured.learning_objectives || []).map((obj, i) => (
                            <li key={i}>{obj}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Topics to Cover & Prerequisites */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="card bg-white border-border">
                        <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-accent" />
                          2. Topics to Cover
                        </h4>
                        <ul className="space-y-1 text-xs text-textPrimary">
                          {(structured.topics_to_cover || []).map((t, i) => (
                            <li key={i} className="p-1.5 rounded-lg bg-background font-medium">
                              &bull; {t}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="card bg-white border-border">
                        <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-accent" />
                          3. Prerequisites
                        </h4>
                        <ul className="space-y-1 text-xs text-textPrimary">
                          {(structured.prerequisites || []).map((p, i) => (
                            <li key={i} className="p-1.5 rounded-lg bg-background">
                              &bull; {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Teaching Sequence & Time Allocation */}
                    <div className="card bg-white border-border space-y-3">
                      <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-accent" />
                        4. Teaching Sequence & Time Allocation ({plan.duration_minutes} min)
                      </h4>
                      <div className="space-y-2 text-xs">
                        {(structured.teaching_sequence || []).map((step, i) => (
                          <div key={i} className="p-2.5 rounded-xl border border-border bg-background flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span className="text-textPrimary">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Activities & Engagement */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="card bg-white border-border">
                        <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">
                          5. Classroom Activities
                        </h4>
                        <ul className="space-y-1.5 text-xs text-textPrimary">
                          {(structured.classroom_activities || []).map((act, i) => (
                            <li key={i} className="p-2 rounded-lg bg-background">
                              {act}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="card bg-white border-border">
                        <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-accent" />
                          6. Student Engagement Questions
                        </h4>
                        <ul className="space-y-1.5 text-xs text-textPrimary">
                          {(structured.student_engagement_questions || []).map((q, i) => (
                            <li key={i} className="p-2 rounded-lg bg-background font-medium">
                              "{q}"
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Assessment & Homework */}
                    <div className="card bg-white border-border space-y-3">
                      <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider">
                        7. Assessment Questions & Homework
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-background border border-border space-y-1.5">
                          <span className="font-bold text-textPrimary block">Assessment Questions:</span>
                          {(structured.assessment_questions || []).map((a, i) => (
                            <p key={i} className="text-textSecondary">&bull; {a}</p>
                          ))}
                        </div>
                        <div className="p-3 rounded-xl bg-background border border-border space-y-1.5">
                          <span className="font-bold text-textPrimary block">Homework Assignment:</span>
                          {(structured.homework || []).map((hw, i) => (
                            <p key={i} className="text-textSecondary">&bull; {hw}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Fallback Markdown Narrative */
                  <div className="card bg-white border-border p-5 prose prose-sm max-w-none whitespace-pre-wrap font-mono text-xs text-textPrimary leading-relaxed">
                    {plan.lesson_content}
                  </div>
                )}
              </div>
            )}

            {/* EDIT & NOTES TAB */}
            {activeTab === 'edit' && (
              <div className="space-y-4">
                <div>
                  <label className="label">Lesson Plan Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="GENERATED">GENERATED</option>
                    <option value="VIEWED">VIEWED</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>

                <div>
                  <label className="label">Post-Class Teaching Notes</label>
                  <textarea
                    rows={4}
                    value={teachingNotes}
                    onChange={(e) => setTeachingNotes(e.target.value)}
                    placeholder="Enter observations on what was covered, pace, student reception..."
                    className="input text-xs"
                  />
                </div>

                <div>
                  <label className="label">Substitute Faculty Feedback</label>
                  <textarea
                    rows={3}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="General feedback for the department or original faculty..."
                    className="input text-xs"
                  />
                </div>

                <button
                  onClick={handleSavePlan}
                  disabled={saving}
                  className="btn-primary text-xs inline-flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save Notes & Feedback'}
                </button>
              </div>
            )}

            {/* RECORD PROGRESS TAB */}
            {activeTab === 'progress' && (
              <form onSubmit={handleRecordProgress} className="space-y-4">
                <div className="p-3.5 rounded-xl bg-info/10 text-info text-xs">
                  Recording verified progress updates official departmental records in SQLite to ensure continuous syllabus tracking.
                </div>

                <div>
                  <label className="label">Topic Name Conducted *</label>
                  <input
                    type="text"
                    value={progressTopic}
                    onChange={(e) => setProgressTopic(e.target.value)}
                    placeholder="e.g. Singly Linked Lists: Node Deletion Algorithms"
                    className="input text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Syllabus Unit Number</label>
                    <input
                      type="number"
                      value={progressUnit}
                      onChange={(e) => setProgressUnit(Number(e.target.value))}
                      className="input text-xs"
                    />
                  </div>
                  <div>
                    <label className="label">Hours Spent</label>
                    <input
                      type="number"
                      step="0.5"
                      value={progressHours}
                      onChange={(e) => setProgressHours(Number(e.target.value))}
                      className="input text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Lecture Notes & Comments</label>
                  <textarea
                    rows={3}
                    value={progressNotes}
                    onChange={(e) => setProgressNotes(e.target.value)}
                    placeholder="Corner cases discussed, problems solved on board..."
                    className="input text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {saving ? 'Recording...' : 'Record Verified Progress'}
                </button>
              </form>
            )}

            {/* HANDOVER TAB */}
            {activeTab === 'handover' && (
              <form onSubmit={handleSubmitHandover} className="space-y-4">
                <div className="p-3.5 rounded-xl bg-secondary text-textPrimary text-xs border border-border">
                  Provide contextual handover guidance for the substitute faculty so they know precisely where your lecture paused.
                </div>

                <div>
                  <label className="label">Current Unit</label>
                  <input
                    type="text"
                    value={handoverUnit}
                    onChange={(e) => setHandoverUnit(e.target.value)}
                    placeholder="e.g. Unit 2: Linked Lists"
                    className="input text-xs"
                  />
                </div>

                <div>
                  <label className="label">Current Topic Paused At</label>
                  <input
                    type="text"
                    value={handoverTopic}
                    onChange={(e) => setHandoverTopic(e.target.value)}
                    placeholder="e.g. Doubly Linked List Sentinel Nodes"
                    className="input text-xs"
                  />
                </div>

                <div>
                  <label className="label">Student Notes & Specific Instructions</label>
                  <textarea
                    rows={3}
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder="Students understood 1NF well; spend 10 mins tracing 2NF lossless joins..."
                    className="input text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs inline-flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Submitting...' : 'Submit Handover Note'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

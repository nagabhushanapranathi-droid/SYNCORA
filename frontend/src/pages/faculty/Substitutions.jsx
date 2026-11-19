import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, Check, BookOpen, MapPin, RefreshCw, FileText, Hourglass } from 'lucide-react'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import { SkeletonRows } from '../../components/LoadingSpinner'
import { PageHeader, ErrorState, Segmented, Avatar } from '../../components/ui'
import { substitutionService } from '../../services/substitutionService'
import { errorMessage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import useLoad from '../../lib/useLoad'
import { splitDuties } from '../../lib/facultyData'
import { asList, formatDate, hhmm, relativeTime } from '../../lib/format'

export default function FacultySubstitutions() {
  const { user } = useAuth()
  const toast = useToast()
  const fid = user?.faculty_id
  const subs = useLoad(() => (fid ? substitutionService.getAll({ faculty_id: fid }).then((d) => asList(d)) : Promise.resolve([])), [fid], { initial: [] })
  const duties = useMemo(() => splitDuties(subs.data, fid), [subs.data, fid])
  const [tab, setTab] = useState('upcoming')
  const [ackId, setAckId] = useState(null)

  const acknowledge = async (s) => {
    setAckId(s.id)
    try {
      await substitutionService.acknowledge(s.id)
      toast.success(`Acknowledged: ${s.subject_name} on ${formatDate(s.date, { weekday: 'long', day: 'numeric', month: 'short' })}.`)
      subs.reload()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not acknowledge this duty.'))
    } finally {
      setAckId(null)
    }
  }

  if (!fid) {
    return (
      <div className="sheet">
        <EmptyState mascot title="No faculty profile linked" description="Cover duties belong to faculty accounts." />
      </div>
    )
  }

  const lists = {
    upcoming: duties.upcoming,
    proposed: duties.proposed,
    past: duties.past,
    mine: duties.coveredForMe,
  }
  const items = lists[tab]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cover duties"
        description="Classes you are covering for colleagues, and your own classes that colleagues cover for you."
        actions={
          <button type="button" className="btn-secondary" onClick={subs.reload} disabled={subs.loading}>
            <RefreshCw className={`w-4 h-4 ${subs.loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {duties.awaitingAck.length > 0 && (
        <div className="rounded-panel bg-accent-soft border border-accent/30 px-4 py-3 text-sm text-ink flex items-center gap-2">
          <Hourglass className="w-4 h-4 text-accent-ink" />
          {duties.awaitingAck.length === 1 ? 'One duty is waiting for your acknowledgment.' : `${duties.awaitingAck.length} duties are waiting for your acknowledgment.`}
        </div>
      )}

      <Segmented
        label="Duties"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'upcoming', label: 'Upcoming', count: duties.upcoming.length },
          { id: 'proposed', label: 'Proposed', count: duties.proposed.length },
          { id: 'past', label: 'Past', count: duties.past.length },
          { id: 'mine', label: 'My classes covered', count: duties.coveredForMe.length },
        ]}
      />

      {subs.loading ? (
        <div className="sheet p-5">
          <SkeletonRows rows={3} />
        </div>
      ) : subs.error ? (
        <div className="sheet">
          <ErrorState message={subs.error} onRetry={subs.reload} />
        </div>
      ) : items.length === 0 ? (
        <div className="sheet">
          <EmptyState
            icon={ArrowLeftRight}
            title={{ upcoming: 'No cover duties ahead', proposed: 'Nothing proposed', past: 'No past duties', mine: 'None of your classes needed cover' }[tab]}
            description={
              {
                upcoming: 'When an administrator approves you to cover a class, it appears here with its lesson plan.',
                proposed: 'When the ranking puts you first for a class, it shows here until an administrator decides.',
                past: 'Completed cover duties are kept here for reference.',
                mine: 'If you are reported absent, each affected class appears here.',
              }[tab]
            }
          />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((s) => (
            <li key={s.id} className="sheet p-5 flex flex-col">
              <div className="flex items-start gap-3">
                <div className="w-14 shrink-0 text-center rounded-panel bg-surface-2 border border-line py-1.5">
                  <p className="text-2xs text-ink-2">{formatDate(s.date, { weekday: 'short' })}</p>
                  <p className="font-heading font-black text-xl text-ink leading-tight tabular">{formatDate(s.date, { day: 'numeric' })}</p>
                  <p className="text-2xs text-ink-2">{formatDate(s.date, { month: 'short' })}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-heading font-extrabold text-lg text-ink leading-snug">{s.subject_name}</h2>
                  <p className="text-sm text-ink-2">
                    {hhmm(s.start_time)}–{hhmm(s.end_time)}, {s.class_name}
                    {s.section ? ` (${s.section})` : ''}
                  </p>
                  {s.classroom && (
                    <p className="text-sm text-ink-2 inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {s.classroom}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2.5 panel px-3 py-2.5">
                {tab === 'mine' ? (
                  <>
                    <Avatar name={s.assignment?.assigned_faculty_name || s.recommended_faculty_name || '?'} size="sm" />
                    <p className="text-sm text-ink-2 flex-1">
                      {['APPROVED', 'ASSIGNED'].includes(s.status) ? (
                        <>
                          Covered by <span className="font-semibold text-ink">{s.assignment?.assigned_faculty_name || s.recommended_faculty_name}</span>
                        </>
                      ) : (
                        'Cover not arranged yet'
                      )}
                    </p>
                    <Badge status={s.status} />
                  </>
                ) : (
                  <>
                    <Avatar name={s.absent_faculty_name} size="sm" />
                    <p className="text-sm text-ink-2 flex-1">
                      Covering for <span className="font-semibold text-ink">{s.absent_faculty_name}</span>
                    </p>
                    {tab === 'proposed' ? (
                      <Badge status="RECOMMENDED" label="Awaiting admin approval" />
                    ) : s.assignment?.is_acknowledged ? (
                      <Badge status="ACKNOWLEDGED" />
                    ) : (
                      <Badge status="AWAITING_ACK" label="Needs your OK" />
                    )}
                  </>
                )}
              </div>

              <div className="mt-4 pt-4 rule flex flex-wrap items-center gap-2">
                {tab === 'upcoming' && !s.assignment?.is_acknowledged && (
                  <button type="button" className="btn-primary btn-sm" onClick={() => acknowledge(s)} disabled={ackId === s.id}>
                    <Check className="w-4 h-4" />
                    {ackId === s.id ? 'Saving…' : 'Acknowledge duty'}
                  </button>
                )}
                {(tab === 'upcoming' || tab === 'past') && (
                  <Link to={`/faculty/lesson-plan/${s.id}`} className="btn-secondary btn-sm">
                    <BookOpen className="w-4 h-4" />
                    {tab === 'past' ? 'Plan and progress' : 'Lesson plan'}
                  </Link>
                )}
                {tab === 'mine' && ['APPROVED', 'ASSIGNED'].includes(s.status) && (
                  <Link to={`/faculty/lesson-plan/${s.id}`} className="btn-secondary btn-sm">
                    <FileText className="w-4 h-4" />
                    Plan and handover
                  </Link>
                )}
                {s.assignment?.acknowledged_at && tab !== 'mine' && <span className="text-xs text-ink-3 ml-auto">Acknowledged {relativeTime(s.assignment.acknowledged_at)}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Shared derivations for the faculty portal. All inputs are API records.
import { isoDate } from './format'

/** Split /substitutions?faculty_id= results into what matters to one faculty member. */
export function splitDuties(list, facultyId) {
  const today = isoDate()
  const mine = (s) => s.assignment?.assigned_faculty_id === facultyId
  const duties = list.filter((s) => mine(s) && ['APPROVED', 'ASSIGNED'].includes(s.status))
  const byDate = (a, b) => (a.date || '').localeCompare(b.date || '') || (a.start_time || '').localeCompare(b.start_time || '')
  return {
    upcoming: duties.filter((s) => s.date >= today).sort(byDate),
    past: duties.filter((s) => s.date < today).sort((a, b) => byDate(b, a)),
    awaitingAck: duties.filter((s) => s.date >= today && !s.assignment?.is_acknowledged),
    // Ranked first but not yet approved by an administrator.
    proposed: list.filter((s) => !s.assignment && s.recommended_faculty_id === facultyId && s.status === 'RECOMMENDED' && s.date >= today).sort(byDate),
    // This faculty member's own classes that colleagues are covering.
    coveredForMe: list.filter((s) => s.absent_faculty_id === facultyId).sort(byDate),
  }
}

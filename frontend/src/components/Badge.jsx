// Status stickers. Every backend status string maps to a semantic tone and a plain label.
const STATUS = {
  PRESENT: ['chip-ok', 'Present'],
  ABSENT: ['chip-danger', 'Absent'],
  LOGGED_OUT: ['chip-neutral', 'Logged out'],
  'LOGGED OUT': ['chip-neutral', 'Logged out'],
  NOT_MARKED: ['chip-warn', 'Not marked'],
  PENDING: ['chip-warn', 'Pending'],
  RECOMMENDED: ['chip-info', 'Recommended'],
  APPROVED: ['chip-ok', 'Approved'],
  ASSIGNED: ['chip-ok', 'Assigned'],
  REJECTED: ['chip-danger', 'Rejected'],
  SUSPENDED: ['chip-neutral', 'Suspended'],
  ACKNOWLEDGED: ['chip-ok', 'Acknowledged'],
  AWAITING_ACK: ['chip-warn', 'Awaiting acknowledgment'],
  ACTIVE: ['chip-ok', 'Active'],
  INACTIVE: ['chip-neutral', 'Inactive'],
  GENERATED: ['chip-info', 'Generated'],
  VIEWED: ['chip-info', 'Viewed'],
  IN_PROGRESS: ['chip-warn', 'In progress'],
  COMPLETED: ['chip-ok', 'Completed'],
  PLANNED: ['chip-neutral', 'Planned'],
  CONNECTED: ['chip-ok', 'Connected'],
  ONLINE: ['chip-ok', 'Online'],
  OFFLINE: ['chip-danger', 'Offline'],
  DEGRADED: ['chip-warn', 'Degraded'],
}

export function statusLabel(status) {
  if (!status) return ''
  const key = String(status).toUpperCase()
  return STATUS[key]?.[1] || String(status).replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

export default function Badge({ status, label, tone, className = '', icon: Icon }) {
  if (!status && !label) return null
  const key = String(status || '').toUpperCase()
  const [cls, text] = STATUS[key] || ['chip-neutral', statusLabel(status)]
  return (
    <span className={`${tone ? `chip-${tone}` : cls} ${className}`}>
      {Icon && <Icon className="w-3 h-3" aria-hidden="true" />}
      {label || text}
    </span>
  )
}

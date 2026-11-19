export default function Badge({ status, className = '' }) {
  if (!status) return null

  const s = String(status).toUpperCase()

  let badgeClass = 'badge-info'
  let label = status

  switch (s) {
    case 'PRESENT':
      badgeClass = 'badge-present'
      label = 'Present'
      break
    case 'ABSENT':
      badgeClass = 'badge-absent'
      label = 'Absent'
      break
    case 'PENDING':
      badgeClass = 'badge-pending'
      label = 'Pending'
      break
    case 'RECOMMENDED':
      badgeClass = 'badge-info'
      label = 'Recommended'
      break
    case 'APPROVED':
      badgeClass = 'badge-approved'
      label = 'Approved'
      break
    case 'REJECTED':
      badgeClass = 'badge-rejected'
      label = 'Rejected'
      break
    case 'SUSPENDED':
      badgeClass = 'badge-suspended'
      label = 'Suspended'
      break
    case 'LOGGED_OUT':
    case 'LOGGED OUT':
      badgeClass = 'badge-suspended'
      label = 'Logged Out'
      break
    case 'ACTIVE':
      badgeClass = 'badge-present'
      label = 'Active'
      break
    case 'ACKNOWLEDGED':
      badgeClass = 'badge-approved'
      label = 'Acknowledged'
      break
    default:
      badgeClass = 'badge-info'
      label = status
      break
  }

  return (
    <span className={`${badgeClass} ${className}`}>
      {label}
    </span>
  )
}

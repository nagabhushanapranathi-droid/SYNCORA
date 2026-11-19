import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Mascot from './Mascot'

export default function ProtectedRoute({ allowedRoles = [], children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
        <Mascot size={64} mood="thinking" />
        <p className="text-sm text-ink-2">Opening your SYNCORA workspace…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const userRole = (user.role || '').toLowerCase()
  const allowed = allowedRoles.map((r) => r.toLowerCase())

  if (allowed.length > 0 && !allowed.includes(userRole)) {
    // Send each role to its own home; never loop between guarded routes.
    if (userRole === 'admin') return <Navigate to="/admin/dashboard" replace />
    if (userRole === 'faculty') return <Navigate to="/faculty/dashboard" replace />
    return <Navigate to="/login" replace />
  }

  return children ? children : <Outlet />
}

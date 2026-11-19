import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from './LoadingSpinner'

export default function ProtectedRoute({ allowedRoles = [], children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner message="Checking authentication..." />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const userRole = (user.role || '').toLowerCase()
  const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase())

  if (allowedRoles.length > 0 && !normalizedAllowed.includes(userRole)) {
    if (userRole === 'admin') {
      return <Navigate to="/admin/dashboard" replace />
    }
    return <Navigate to="/faculty/dashboard" replace />
  }

  return children ? children : <Outlet />
}

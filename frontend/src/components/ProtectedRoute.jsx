import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Wraps a route so only authenticated users can access it.
 * Optional role prop restricts to a specific role.
 * - No user → /login
 * - Wrong role:
 *     athlete trying to access coach route → /athlete
 *     coach trying to access athlete route → /dashboard
 */
export default function ProtectedRoute({ children, role }) {
  const { user, role: userRole, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  if (role && userRole !== role) {
    return <Navigate to={userRole === 'athlete' ? '/athlete' : '/dashboard'} replace />
  }

  return children
}

import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Wraps a route so only authenticated users can access it.
 * While auth state is loading, renders nothing (avoids flash).
 * Optionally restrict to a specific role: <ProtectedRoute role="coach">
 */
export default function ProtectedRoute({ children, role }) {
  const { user, role: userRole, loading } = useAuth()

  if (loading) return null

  if (!user) return <Navigate to="/login" replace />

  if (role && userRole !== role) return <Navigate to="/" replace />

  return children
}

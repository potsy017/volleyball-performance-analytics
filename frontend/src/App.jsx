import { Routes, Route, Navigate } from 'react-router-dom'
import { DashboardProvider } from './context/DashboardContext'
import { useAuth } from './context/AuthContext'
import Navbar from './components/layout/Navbar'
import DarkVeil from './components/ui/DarkVeil'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import AuthPage from './pages/AuthPage'
import AthletePage from './pages/AthletePage'
import MainDashboard from './pages/MainDashboard'
import Gymaware from './pages/Gymaware'
import Catapult from './pages/Catapult'
import Vald from './pages/Vald'
import Whoop from './pages/Whoop'
import AthleteReport from './pages/AthleteReport'
import Readiness from './pages/Readiness'

// Redirect based on role after login
function RoleRedirect() {
  const { user, role, loading, authDisabled } = useAuth()
  if (loading) return null
  if (!user && !authDisabled) return <Navigate to="/login" replace />
  if (role === 'athlete') return <Navigate to="/athlete" replace />
  return <Navigate to="/dashboard" replace />
}

function CoachShell() {
  return (
    <DashboardProvider>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, pointerEvents: 'none' }}>
        <DarkVeil speed={0.25} hueShift={0} noiseIntensity={0.04} warpAmount={0.8} resolutionScale={0.75} />
      </div>
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        <Navbar />
        <main>
          <ErrorBoundary>
            <Routes>
              <Route path="/dashboard"  element={<ErrorBoundary><MainDashboard /></ErrorBoundary>} />
              <Route path="/gymaware"   element={<ErrorBoundary><Gymaware /></ErrorBoundary>} />
              <Route path="/catapult"   element={<ErrorBoundary><Catapult /></ErrorBoundary>} />
              <Route path="/vald"       element={<ErrorBoundary><Vald /></ErrorBoundary>} />
              <Route path="/whoop"      element={<ErrorBoundary><Whoop /></ErrorBoundary>} />
              <Route path="/readiness"  element={<ErrorBoundary><Readiness /></ErrorBoundary>} />
              <Route path="/report"     element={<ErrorBoundary><AthleteReport /></ErrorBoundary>} />
              <Route path="*"           element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </DashboardProvider>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"   element={<AuthPage />} />
      <Route path="/signup"  element={<AuthPage />} />
      <Route path="/athlete" element={<ProtectedRoute role="athlete"><AthletePage /></ProtectedRoute>} />
      <Route path="/"        element={<RoleRedirect />} />
      <Route path="/*"       element={<ProtectedRoute role="coach"><CoachShell /></ProtectedRoute>} />
    </Routes>
  )
}

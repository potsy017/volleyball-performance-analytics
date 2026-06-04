import { Routes, Route } from 'react-router-dom'
import { DashboardProvider } from './context/DashboardContext'
import Navbar from './components/layout/Navbar'
import DarkVeil from './components/ui/DarkVeil'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import MainDashboard from './pages/MainDashboard'
import Gymaware from './pages/Gymaware'
import Catapult from './pages/Catapult'
import Vald from './pages/Vald'
import Whoop from './pages/Whoop'
import AthleteReport from './pages/AthleteReport'
import Readiness from './pages/Readiness'

function AppShell() {
  return (
    <DashboardProvider>
      {/* Fixed full-screen DarkVeil background */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
      }}>
        <DarkVeil
          speed={0.25}
          hueShift={0}
          noiseIntensity={0.04}
          warpAmount={0.8}
          resolutionScale={0.75}
        />
      </div>

      {/* App content */}
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        <Navbar />
        <main>
          <ErrorBoundary>
            <Routes>
              <Route path="/"          element={<ProtectedRoute><ErrorBoundary><MainDashboard /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/gymaware"  element={<ProtectedRoute><ErrorBoundary><Gymaware /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/catapult"  element={<ProtectedRoute><ErrorBoundary><Catapult /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/vald"      element={<ProtectedRoute><ErrorBoundary><Vald /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/whoop"     element={<ProtectedRoute><ErrorBoundary><Whoop /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/readiness" element={<ProtectedRoute><ErrorBoundary><Readiness /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/report"    element={<ProtectedRoute><ErrorBoundary><AthleteReport /></ErrorBoundary></ProtectedRoute>} />
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
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/*" element={<AppShell />} />
    </Routes>
  )
}
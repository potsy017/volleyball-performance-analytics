import { Routes, Route } from 'react-router-dom'
import { DashboardProvider } from './context/DashboardContext'
import Navbar from './components/layout/Navbar'
import DarkVeil from './components/ui/DarkVeil'
import ErrorBoundary from './components/ErrorBoundary'
import MainDashboard from './pages/MainDashboard'
import Gymaware from './pages/Gymaware'
import Catapult from './pages/Catapult'
import Vald from './pages/Vald'
import Whoop from './pages/Whoop'

export default function App() {
  return (
    <DashboardProvider>
      {/* Fixed full-screen DarkVeil background — sits behind everything */}
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

      {/* App content — sits above the background */}
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        <Navbar />
        <main>
          <ErrorBoundary>
            <Routes>
              <Route path="/"         element={<ErrorBoundary><MainDashboard /></ErrorBoundary>} />
              <Route path="/gymaware" element={<ErrorBoundary><Gymaware /></ErrorBoundary>} />
              <Route path="/catapult" element={<ErrorBoundary><Catapult /></ErrorBoundary>} />
              <Route path="/vald"     element={<ErrorBoundary><Vald /></ErrorBoundary>} />
              <Route path="/whoop"    element={<ErrorBoundary><Whoop /></ErrorBoundary>} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </DashboardProvider>
  )
}

import { createContext, useContext, useState } from 'react'

const DashboardContext = createContext(null)

export function DashboardProvider({ children }) {
  const [selectedAthlete, setSelectedAthlete] = useState(null)
  const [days, setDays] = useState(7)
  const [viewMode, setViewMode] = useState('rolling')

  return (
    <DashboardContext.Provider value={{
      selectedAthlete, setSelectedAthlete,
      days, setDays,
      viewMode, setViewMode,
    }}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used inside DashboardProvider')
  return ctx
}

import { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { athleteApi } from '../../services/api'
import { useDashboard } from '../../context/DashboardContext'

const NAV_ITEMS = [
  { to: '/',         label: 'Dashboard' },
  { to: '/readiness', label: 'Readiness' },
  { to: '/gymaware', label: 'Gymaware'  },
  { to: '/catapult', label: 'Catapult'  },
  { to: '/vald',     label: 'VALD'      },
  { to: '/whoop',    label: 'WHOOP'     },
]

function AthleteDropdown({ athletes, selectedAthlete, setSelectedAthlete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = athletes.find(a => a.athlete_internal_key === selectedAthlete)
  const label = selected ? selected.athlete_display_name : 'All Athletes'

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: '180px', flexShrink: 0 }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '6px 12px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          color: 'var(--text-primary)',
          fontSize: '13px',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <span>{label}</span>
        <span style={{
          fontSize: '10px',
          color: 'var(--text-secondary)',
          transition: 'transform 0.15s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▼</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          minWidth: '100%',
          background: '#1A1C23',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          overflow: 'hidden',
          zIndex: 200,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          maxHeight: '340px',
          overflowY: 'auto',
        }}>
          {/* All Athletes */}
          <div
            onClick={() => { setSelectedAthlete(null); setOpen(false) }}
            style={{
              padding: '9px 14px',
              fontSize: '13px',
              cursor: 'pointer',
              color: !selectedAthlete ? 'var(--primary)' : 'var(--text-secondary)',
              background: !selectedAthlete ? 'rgba(200,230,0,0.08)' : 'transparent',
              borderBottom: '1px solid var(--border)',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = !selectedAthlete ? 'rgba(200,230,0,0.08)' : 'transparent'}
          >
            All Athletes
          </div>

          {/* Athlete list */}
          {athletes.map(a => {
            const isActive = selectedAthlete === a.athlete_internal_key
            return (
              <div
                key={a.athlete_internal_key}
                onClick={() => { setSelectedAthlete(a.athlete_internal_key); setOpen(false) }}
                style={{
                  padding: '9px 14px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  color: isActive ? 'var(--primary)' : 'var(--text-primary)',
                  background: isActive ? 'rgba(200,230,0,0.08)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = isActive ? 'rgba(200,230,0,0.08)' : 'transparent'}
              >
                {a.athlete_display_name}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const { selectedAthlete, setSelectedAthlete } = useDashboard()
  const { data: athletesRaw, isError, error } = useQuery({
    queryKey: ['athletes'],
    queryFn: athleteApi.list,
    retry: 2,
  })
  const athletes = Array.isArray(athletesRaw) ? athletesRaw : []

  return (
    <nav style={{
      background: 'var(--bg-nav)',
      borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '32px', flexShrink: 0 }}>
        <div style={{
          width: '32px', height: '32px',
          background: 'var(--primary)',
          borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '14px', color: '#0A0B0E',
          letterSpacing: '-0.5px',
        }}>
          <img src="/vpa-logo.png" />
        </div>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
          Volleyball Performance Analysis
        </span>
      </div>

      {/* Nav tabs */}
      <div style={{ display: 'flex', gap: '2px', flex: 1 }}>
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: isActive ? 500 : 400,
              color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
              background: isActive ? 'rgba(200,230,0,0.08)' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.15s',
              border: isActive ? '1px solid rgba(200,230,0,0.2)' : '1px solid transparent',
            })}
          >
            {label}
          </NavLink>
        ))}
      </div>

      {/* Athlete selector */}
      {isError ? (
        <span style={{ fontSize: '12px', color: '#F44336', maxWidth: 220 }} title={error?.message}>
          Athletes failed to load
        </span>
      ) : (
        <AthleteDropdown
          athletes={athletes}
          selectedAthlete={selectedAthlete}
          setSelectedAthlete={setSelectedAthlete}
        />
      )}
    </nav>
  )
}

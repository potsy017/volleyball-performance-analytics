import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api, { athleteApi } from '../../services/api'
import { useDashboard } from '../../context/DashboardContext'
import { useAuth } from '../../context/AuthContext'

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

function CoachRequestButton({ userEmail }) {
  const [state, setState] = useState('idle') // idle | loading | success | error | already
  const [showModal, setShowModal] = useState(false)
  const [reason, setReason] = useState('')

  async function submit() {
    setState('loading')
    try {
      await api.post('/request-coach-access', { email: userEmail, reason })
      setState('success')
      setShowModal(false)
    } catch (err) {
      if (err?.response?.status === 409) { setState('already'); setShowModal(false); return }
      console.error('Coach request failed:', err?.response?.status, err?.response?.data)
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <span style={{ fontSize: '12px', color: '#7cff67', padding: '0 8px' }}>
        ✓ Request sent
      </span>
    )
  }
  if (state === 'already') {
    return (
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', padding: '0 8px' }}>
        Request pending…
      </span>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        style={{
          padding: '6px 12px',
          background: 'rgba(124,255,103,0.1)',
          border: '1px solid rgba(124,255,103,0.3)',
          borderRadius: '8px',
          color: '#7cff67',
          fontSize: '12px',
          fontWeight: 500,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,255,103,0.2)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,255,103,0.1)'}
      >
        Request Coach Access
      </button>

      {/* Modal — rendered via portal so it escapes the sticky navbar stacking context */}
      {showModal && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div style={{
            background: '#1A1C23',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '14px',
            padding: '32px',
            width: '100%',
            maxWidth: '420px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              Request Coach Access
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>
              Your request will be sent to the admin team. They will review and update your access directly.
            </div>

            <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>
              Reason <span style={{ color: 'rgba(255,255,255,0.3)' }}>(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. I'm a coach for the U18 team…"
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                padding: '10px 12px',
                color: '#fff',
                fontSize: '13px',
                resize: 'vertical',
                outline: 'none',
                marginBottom: '20px',
              }}
            />

            {state === 'error' && (
              <div style={{ color: '#ff8080', fontSize: '13px', marginBottom: '12px' }}>
                Something went wrong. Try again.
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={state === 'loading'}
                style={{
                  padding: '8px 20px',
                  background: 'linear-gradient(135deg, #7cff67 0%, #5227FF 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#0a0a1a',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: state === 'loading' ? 'not-allowed' : 'pointer',
                  opacity: state === 'loading' ? 0.6 : 1,
                }}
              >
                {state === 'loading' ? 'Sending…' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default function Navbar() {
  const { selectedAthlete, setSelectedAthlete } = useDashboard()
  const { user, role, signOut } = useAuth()
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
      gap: '12px',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '20px', flexShrink: 0 }}>
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

      {/* Right side controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {/* Request Coach Access — only shown to athletes */}
        {role === 'athlete' && (
          <CoachRequestButton userEmail={user?.email} />
        )}

        {/* Athlete selector — only for coaches */}
        {role === 'coach' && (
          isError ? (
            <span style={{ fontSize: '12px', color: '#F44336', maxWidth: 220 }} title={error?.message}>
              Athletes failed to load
            </span>
          ) : (
            <AthleteDropdown
              athletes={athletes}
              selectedAthlete={selectedAthlete}
              setSelectedAthlete={setSelectedAthlete}
            />
          )
        )}

        {/* Sign out */}
        {user && (
          <button
            onClick={signOut}
            style={{
              padding: '5px 10px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '7px',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
          >
            Sign out
          </button>
        )}
      </div>
    </nav>
  )
}

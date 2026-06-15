import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import api, { athleteApi } from '../../services/api'
import { useDashboard } from '../../context/DashboardContext'
import { useAuth } from '../../context/AuthContext'
import StaggeredMenu from '../ui/StaggeredMenu'

function AthleteDropdown({ athletes, selectedAthlete, setSelectedAthlete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const selected = athletes.find(a => a.athlete_internal_key === selectedAthlete)
  const label = selected ? selected.athlete_display_name : 'All Athletes'
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: '180px', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer', outline: 'none' }}>
        <span>{label}</span>
        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: '100%', background: '#1A1C23', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', maxHeight: '340px', overflowY: 'auto' }}>
          <div onClick={() => { setSelectedAthlete(null); setOpen(false) }} style={{ padding: '9px 14px', fontSize: '13px', cursor: 'pointer', color: !selectedAthlete ? 'var(--primary)' : 'var(--text-secondary)', background: !selectedAthlete ? 'rgba(200,230,0,0.08)' : 'transparent', borderBottom: '1px solid var(--border)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = !selectedAthlete ? 'rgba(200,230,0,0.08)' : 'transparent'}>
            All Athletes
          </div>
          {athletes.map(a => {
            const isActive = selectedAthlete === a.athlete_internal_key
            return (
              <div key={a.athlete_internal_key} onClick={() => { setSelectedAthlete(a.athlete_internal_key); setOpen(false) }}
                style={{ padding: '9px 14px', fontSize: '13px', cursor: 'pointer', color: isActive ? 'var(--primary)' : 'var(--text-primary)', background: isActive ? 'rgba(200,230,0,0.08)' : 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = isActive ? 'rgba(200,230,0,0.08)' : 'transparent'}>
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
  const [state, setState] = useState('idle')
  const [showModal, setShowModal] = useState(false)
  const [reason, setReason] = useState('')
  async function submit() {
    setState('loading')
    try {
      await api.post('/request-coach-access', { email: userEmail, reason })
      setState('success'); setShowModal(false)
    } catch (err) {
      if (err?.response?.status === 409) { setState('already'); setShowModal(false); return }
      setState('error')
    }
  }
  if (state === 'success') return <span style={{ fontSize: '12px', color: '#7cff67', padding: '0 8px' }}>✓ Request sent</span>
  if (state === 'already') return <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', padding: '0 8px' }}>Request pending…</span>
  return (
    <>
      <button onClick={() => setShowModal(true)} style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #00843D 0%, #FFCD00 100%)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 10px rgba(0,132,61,0.3)' }}>
        Request Coach Access
      </button>
      {showModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ background: '#1A1C23', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '14px', padding: '32px', width: '100%', maxWidth: '420px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>Request Coach Access</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>Your request will be sent to the admin team.</div>
            <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>Reason <span style={{ color: 'rgba(255,255,255,0.3)' }}>(optional)</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. I'm a coach for the U18 team…" rows={3} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '10px 12px', color: '#fff', fontSize: '13px', resize: 'vertical', outline: 'none', marginBottom: '20px' }} />
            {state === 'error' && <div style={{ color: '#ff8080', fontSize: '13px', marginBottom: '12px' }}>Something went wrong. Try again.</div>}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={submit} disabled={state === 'loading'} style={{ padding: '8px 20px', background: 'linear-gradient(135deg, #00843D 0%, #FFCD00 100%)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: state === 'loading' ? 'not-allowed' : 'pointer', opacity: state === 'loading' ? 0.6 : 1 }}>
                {state === 'loading' ? 'Sending…' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>, document.body
      )}
    </>
  )
}

export default function Navbar() {
  const { selectedAthlete, setSelectedAthlete } = useDashboard()
  const { user, role, signOut } = useAuth()
  const { data: athletesRaw, isError, error } = useQuery({ queryKey: ['athletes'], queryFn: athleteApi.list, retry: 2 })
  const athletes = Array.isArray(athletesRaw) ? athletesRaw : []

  return (
    <nav style={{ background: 'var(--bg-nav)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', height: '56px', display: 'flex', alignItems: 'center', padding: '0 24px', position: 'sticky', top: 0, zIndex: 100, gap: '12px' }}>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <div style={{ width: '32px', height: '32px', background: 'var(--primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/vpa-logo.png" alt="VPA" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }} />
        </div>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
          Volleyball Performance Analysis
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {role === 'athlete' && <CoachRequestButton userEmail={user?.email} />}
        {role === 'coach' && (
          isError
            ? <span style={{ fontSize: '12px', color: '#F44336', maxWidth: 220 }} title={error?.message}>Athletes failed to load</span>
            : <AthleteDropdown athletes={athletes} selectedAthlete={selectedAthlete} setSelectedAthlete={setSelectedAthlete} />
        )}
        {user && <StaggeredMenu user={user} onSignOut={signOut} />}
      </div>
    </nav>
  )
}

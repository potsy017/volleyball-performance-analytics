import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import ColorBends from '../components/ui/ColorBends'

export default function AthletePage() {
  const { user, signOut } = useAuth()
  const [reqState, setReqState] = useState('idle') // idle | loading | success | already | error
  const [showModal, setShowModal] = useState(false)
  const [reason, setReason] = useState('')

  async function submitRequest() {
    setReqState('loading')
    try {
      await api.post('/request-coach-access', { email: user?.email, reason })
      setReqState('success')
      setShowModal(false)
    } catch (err) {
      if (err?.response?.status === 409) { setReqState('already'); setShowModal(false); return }
      setReqState('error')
    }
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#050510' }}>
      {/* ColorBends background */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <ColorBends
          colors={['#00843D', '#FFCD00', '#005C2B', '#FFE566']}
          speed={0.15}
          warpStrength={1.2}
          intensity={1.2}
          bandWidth={5}
          noise={0.1}
          transparent={false}
        />
      </div>

      {/* Dark overlay */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'rgba(5,5,16,0.65)' }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: '32px', padding: '24px',
        textAlign: 'center',
      }}>
        {/* Logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src="/vpa-logo.png" style={{ width: '64px', height: '64px', objectFit: 'contain' }} alt="VPA" />
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
            Volleyball Performance Analysis
          </div>
        </div>

        {/* Coming soon card */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '20px',
          padding: '48px 56px',
          maxWidth: '480px',
          width: '100%',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏐</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>
            Athlete Page Coming Soon
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
            Your personal performance dashboard is under construction.<br />
            Check back soon for your stats and analytics.
          </div>

          {user?.email && (
            <div style={{ marginTop: '20px', fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>
              Signed in as <span style={{ color: 'rgba(255,255,255,0.6)' }}>{user.email}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {reqState === 'success' ? (
            <div style={{ padding: '10px 20px', background: 'rgba(124,255,103,0.1)', border: '1px solid rgba(124,255,103,0.3)', borderRadius: '10px', color: '#7cff67', fontSize: '14px' }}>
              ✓ Coach access request sent
            </div>
          ) : reqState === 'already' ? (
            <div style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
              Request pending review…
            </div>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: '10px 22px',
                background: 'linear-gradient(135deg, #00843D 0%, #FFCD00 100%)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '14px', fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(0,132,61,0.35)',
              }}
            >
              Request Coach Access
            </button>
          )}

          <button
            onClick={signOut}
            style={{
              padding: '10px 22px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '10px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '14px', fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Request modal via portal */}
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
            width: '100%', maxWidth: '420px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>Request Coach Access</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>
              The admin team will review your request and update your access directly.
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
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px', padding: '10px 12px', color: '#fff',
                fontSize: '13px', resize: 'vertical', outline: 'none', marginBottom: '20px',
              }}
            />
            {reqState === 'error' && (
              <div style={{ color: '#ff8080', fontSize: '13px', marginBottom: '12px' }}>Something went wrong. Try again.</div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitRequest} disabled={reqState === 'loading'} style={{ padding: '8px 20px', background: 'linear-gradient(135deg, #00843D 0%, #FFCD00 100%)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: reqState === 'loading' ? 'not-allowed' : 'pointer', opacity: reqState === 'loading' ? 0.6 : 1, boxShadow: '0 2px 12px rgba(0,132,61,0.35)' }}>
                {reqState === 'loading' ? 'Sending…' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

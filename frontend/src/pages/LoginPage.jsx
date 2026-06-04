import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../context/AuthContext'
import Aurora from '../components/ui/Aurora'

const inputStyle = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '8px',
  padding: '10px 14px',
  color: '#fff',
  fontSize: '14px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const focusGreen = e => e.target.style.borderColor = 'rgba(124,255,103,0.6)'
const blurGrey   = e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  // Step 1: password auth — Step 2: OTP verify
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // ── Step 1: validate password, sign out, send OTP ──────────────────────────
  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Validate credentials
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) throw signInErr

      // Sign out immediately — session will be granted after OTP
      await supabase.auth.signOut()

      // Send OTP to email
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      })
      if (otpErr) throw otpErr

      setStep(2)
    } catch (err) {
      setError(err.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: verify OTP ─────────────────────────────────────────────────────
  async function handleOtpSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: 'email',
      })
      if (verifyErr) throw verifyErr
      navigate('/')
    } catch (err) {
      setError(err.message ?? 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#050510' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Aurora colorStops={['#7cff67', '#B497CF', '#5227FF']} blend={0.5} amplitude={1.0} speed={0.5} />
      </div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'rgba(5,5,16,0.55)' }} />

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px',
          padding: '48px 40px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', marginBottom: '6px' }}>VPA</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px' }}>
              {step === 1 ? 'Volleyball Performance Analytics' : 'Check your email'}
            </div>
          </div>

          {/* ── Step 1: Email + Password ── */}
          {step === 1 && (
            <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 500 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" style={inputStyle} onFocus={focusGreen} onBlur={blurGrey} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 500 }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" style={inputStyle} onFocus={focusGreen} onBlur={blurGrey} />
              </div>

              {error && <ErrorBox message={error} />}

              <SubmitButton loading={loading} label="Continue" loadingLabel="Verifying..." />
            </form>
          )}

          {/* ── Step 2: OTP ── */}
          {step === 2 && (
            <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textAlign: 'center', marginBottom: '4px' }}>
                We sent a 6-digit code to <strong style={{ color: '#fff' }}>{email}</strong>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 500 }}>Verification code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  placeholder="000000"
                  maxLength={6}
                  style={{ ...inputStyle, letterSpacing: '6px', fontSize: '20px', textAlign: 'center' }}
                  onFocus={focusGreen}
                  onBlur={blurGrey}
                  autoFocus
                />
              </div>

              {error && <ErrorBox message={error} />}

              <SubmitButton loading={loading} label="Sign In" loadingLabel="Verifying..." />

              <button
                type="button"
                onClick={() => { setStep(1); setOtp(''); setError('') }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '13px', cursor: 'pointer', textAlign: 'center' }}
              >
                ← Back
              </button>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
            No account?{' '}
            <Link to="/signup" style={{ color: '#7cff67', textDecoration: 'none' }}>Create one</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function ErrorBox({ message }) {
  return (
    <div style={{ background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#ff8080', fontSize: '13px' }}>
      {message}
    </div>
  )
}

function SubmitButton({ loading, label, loadingLabel }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        marginTop: '8px',
        background: loading ? 'rgba(124,255,103,0.3)' : 'linear-gradient(135deg, #7cff67 0%, #5227FF 100%)',
        border: 'none',
        borderRadius: '8px',
        padding: '12px',
        color: loading ? 'rgba(255,255,255,0.5)' : '#0a0a1a',
        fontSize: '14px',
        fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        width: '100%',
      }}
    >
      {loading ? loadingLabel : label}
    </button>
  )
}

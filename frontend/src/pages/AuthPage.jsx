import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../context/AuthContext'
import api from '../services/api'
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
const focusGreen = e => e.target.style.borderColor = 'rgba(0,132,61,0.8)'
const blurGrey   = e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'

function ErrorBox({ message }) {
  return (
    <div style={{ background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#ff8080', fontSize: '13px' }}>
      {message}
    </div>
  )
}

function SubmitBtn({ loading, label, loadingLabel }) {
  return (
    <button type="submit" disabled={loading} style={{
      marginTop: '6px', width: '100%',
      background: loading ? 'rgba(0,132,61,0.3)' : 'linear-gradient(135deg, #00843D 0%, #FFCD00 100%)',
      border: 'none', borderRadius: '8px', padding: '12px',
      color: loading ? 'rgba(255,255,255,0.5)' : '#fff',
      fontSize: '14px', fontWeight: 600,
      cursor: loading ? 'not-allowed' : 'pointer',
    }}>
      {loading ? loadingLabel : label}
    </button>
  )
}

// ── OTP step — user is now authenticated, safe to upsert profile ─────────────
function OtpStep({ email, name, isSignup, onBack }) {
  const navigate = useNavigate()
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleOtp(e) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const { data, error: err } = await supabase.auth.verifyOtp({ email, token: otp.trim(), type: 'email' })
      if (err) throw err

      // After OTP, call backend to upsert profile using service role key (bypasses RLS)
      if (isSignup) {
        await api.post('/init-profile', { email, name: name || email })
      }

      navigate('/')
    } catch (err) { setError(err.message ?? 'Invalid code') }
    finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textAlign: 'center' }}>
        Code sent to <strong style={{ color: '#fff' }}>{email}</strong>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 500 }}>Verification code</label>
        <input
          type="text"
          value={otp}
          onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
          required
          placeholder="- - - - - - - -"
          maxLength={8}
          style={{ ...inputStyle, letterSpacing: '8px', fontSize: '20px', textAlign: 'center' }}
          onFocus={focusGreen} onBlur={blurGrey} autoFocus
        />
      </div>
      {error && <ErrorBox message={error} />}
      <SubmitBtn loading={loading} label="Verify & Sign In" loadingLabel="Verifying…" />
      <button type="button" onClick={onBack}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '13px', cursor: 'pointer', textAlign: 'center' }}>
        ← Back
      </button>
    </form>
  )
}

// ── Login flow ───────────────────────────────────────────────────────────────
function LoginForm() {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handlePassword(e) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
      await supabase.auth.signOut()
      const { error: otpErr } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
      if (otpErr) throw otpErr
      setStep(2)
    } catch (err) { setError(err.message ?? 'Login failed') }
    finally { setLoading(false) }
  }

  if (step === 2) return (
    <OtpStep email={email} isSignup={false} onBack={() => { setStep(1); setError('') }} />
  )

  return (
    <form onSubmit={handlePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 500 }}>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" style={inputStyle} onFocus={focusGreen} onBlur={blurGrey} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 500 }}>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" style={inputStyle} onFocus={focusGreen} onBlur={blurGrey} />
      </div>
      {error && <ErrorBox message={error} />}
      <SubmitBtn loading={loading} label="Continue" loadingLabel="Verifying…" />
    </form>
  )
}

// ── Signup flow ──────────────────────────────────────────────────────────────
function SignupForm() {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e) {
    e.preventDefault(); setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (!/[A-Z]/.test(password)) { setError('Password must contain at least 1 uppercase letter'); return }
    if (!/[a-z]/.test(password)) { setError('Password must contain at least 1 lowercase letter'); return }
    if (!/[0-9]/.test(password)) { setError('Password must contain at least 1 number'); return }
    if ((password.match(/[^A-Za-z0-9]/g) || []).length < 2) { setError('Password must contain at least 2 special characters'); return }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signUp({ email, password })
      if (err) throw err
      // Sign out (in case of auto-login), then send OTP
      await supabase.auth.signOut()
      const { error: otpErr } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
      if (otpErr) throw otpErr
      setStep(2)
    } catch (err) {
      const msg = err.message ?? 'Signup failed'
      setError(msg.includes('after') ? 'Please wait 60 seconds before requesting a new code.' : msg)
    }
    finally { setLoading(false) }
  }

  // Pass name to OtpStep so it can upsert after verification
  if (step === 2) return (
    <OtpStep email={email} name={name} isSignup={true} onBack={() => { setStep(1); setError('') }} />
  )

  return (
    <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[
        { label: 'Full Name', val: name, set: setName, type: 'text', ph: 'Jane Smith' },
        { label: 'Email', val: email, set: setEmail, type: 'email', ph: 'you@example.com' },
        { label: 'Password', val: password, set: setPassword, type: 'password', ph: '••••••••' },
        { label: 'Confirm Password', val: confirm, set: setConfirm, type: 'password', ph: '••••••••' },
      ].map(({ label, val, set, type, ph }) => (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 500 }}>{label}</label>
          <input type={type} value={val} onChange={e => set(e.target.value)} required placeholder={ph} style={inputStyle} onFocus={focusGreen} onBlur={blurGrey} />
        </div>
      ))}
      {error && <ErrorBox message={error} />}
      <SubmitBtn loading={loading} label="Create Account" loadingLabel="Creating…" />
    </form>
  )
}

// ── Main AuthPage ─────────────────────────────────────────────────────────────
export default function AuthPage() {
  const [tab, setTab] = useState('login')

  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{
      flex: 1, padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer',
      background: tab === id ? 'rgba(0,132,61,0.15)' : 'transparent',
      color: tab === id ? '#00843D' : 'rgba(255,255,255,0.4)',
      fontSize: '14px', fontWeight: tab === id ? 600 : 400,
      transition: 'all 0.15s', outline: 'none',
    }}>{label}</button>
  )

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#050510' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Aurora colorStops={['#00843D', '#FFCD00', '#00843D']} blend={0.6} amplitude={1.0} speed={0.4} />
      </div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'rgba(5,5,16,0.55)' }} />

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px', padding: '40px',
          width: '100%', maxWidth: '420px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}>
          {/* Logo + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
            <img src="/vpa-logo.png" style={{ width: '56px', height: '56px', objectFit: 'contain', flexShrink: 0 }} alt="VPA" />
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.3 }}>
              Volleyball Performance Analysis
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '4px', marginBottom: '24px' }}>
            {tabBtn('login', 'Sign In')}
            {tabBtn('signup', 'Sign Up')}
          </div>

          {tab === 'login' ? <LoginForm /> : <SignupForm />}
        </div>
      </div>
    </div>
  )
}

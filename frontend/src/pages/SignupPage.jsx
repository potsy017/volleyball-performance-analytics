import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Aurora from '../components/ui/Aurora'

export default function SignupPage() {
  const { signIn, supabase } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) throw signUpError

      // Update the profile name (trigger already set role = 'athlete')
      if (data.user) {
        await supabase
          .from('profiles')
          .update({ name })
          .eq('id', data.user.id)
      }

      // Sign in immediately after signup
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message ?? 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#050510' }}>
      {/* Aurora background */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Aurora
          colorStops={['#7cff67', '#B497CF', '#5227FF']}
          blend={0.5}
          amplitude={1.0}
          speed={0.5}
        />
      </div>

      {/* Dark overlay */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'rgba(5,5,16,0.55)' }} />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%',
      }}>
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
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', marginBottom: '6px' }}>
              VPA
            </div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px' }}>
              Create your athlete account
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: 'Full Name', value: name, set: setName, type: 'text', placeholder: 'Jane Smith' },
              { label: 'Email', value: email, set: setEmail, type: 'email', placeholder: 'you@example.com' },
              { label: 'Password', value: password, set: setPassword, type: 'password', placeholder: '••••••••' },
              { label: 'Confirm Password', value: confirm, set: setConfirm, type: 'password', placeholder: '••••••••' },
            ].map(({ label, value, set, type, placeholder }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 500 }}>{label}</label>
                <input
                  type={type}
                  value={value}
                  onChange={e => set(e.target.value)}
                  required
                  placeholder={placeholder}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(124,255,103,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                />
              </div>
            ))}

            {error && (
              <div style={{
                background: 'rgba(255,80,80,0.12)',
                border: '1px solid rgba(255,80,80,0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#ff8080',
                fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '6px',
                background: loading
                  ? 'rgba(124,255,103,0.3)'
                  : 'linear-gradient(135deg, #7cff67 0%, #5227FF 100%)',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                color: loading ? 'rgba(255,255,255,0.5)' : '#0a0a1a',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#7cff67', textDecoration: 'none' }}>Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

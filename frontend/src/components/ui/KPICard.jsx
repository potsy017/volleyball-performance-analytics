import { useEffect, useRef, useState } from 'react'

function useCountUp(target, duration = 800) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (target == null || isNaN(target)) { setDisplay(target); return }
    const start = Date.now()
    const from = 0
    const to = Number(target)
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + (to - from) * ease)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target])
  return display
}

export default function KPICard({ label, value, unit = '', sub, color, icon, decimals = 1 }) {
  const animated = useCountUp(typeof value === 'number' ? value : null)
  const displayVal = typeof value === 'number'
    ? (animated != null ? animated : value).toFixed(decimals)
    : (value ?? '—')

  const accentColor = color || 'var(--primary)'

  return (
    <div className="card" style={{ minWidth: 0 }}>
      <div style={{
        fontSize: '11px',
        fontWeight: 500,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        {icon && <span style={{ fontSize: '14px' }}>{icon}</span>}
        {label}
      </div>
      <div className="kpi-value" style={{
        fontSize: '28px',
        fontWeight: 600,
        color: accentColor,
        lineHeight: 1,
        marginBottom: '4px',
      }}>
        {displayVal}
        {unit && <span style={{ fontSize: '14px', marginLeft: '4px', color: 'var(--text-secondary)', fontWeight: 400 }}>{unit}</span>}
      </div>
      {sub && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

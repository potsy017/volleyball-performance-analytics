import { useState } from 'react'

const PRESETS = [
  { label: '7d',  days: 7  },
  { label: '14d', days: 14 },
  { label: '28d', days: 28 },
  { label: '3m',  days: 90 },
]

const inputStyle = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  padding: '5px 8px',
  fontSize: '12px',
  outline: 'none',
  colorScheme: 'dark',
}

/**
 * DateRangePicker
 * Props:
 *   days     — current days value
 *   onChange — (days: number) => void
 */
export default function DateRangePicker({ days, onChange }) {
  const [custom, setCustom]     = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate]     = useState(new Date().toISOString().slice(0, 10))

  const today = new Date().toISOString().slice(0, 10)

  const applyCustom = () => {
    if (!fromDate) return
    const from  = new Date(fromDate)
    const to    = toDate ? new Date(toDate) : new Date()
    const diff  = Math.max(1, Math.ceil((to - from) / 86_400_000))
    onChange(diff)
    setCustom(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <div className="toggle-group">
        {PRESETS.map(p => (
          <button
            key={p.days}
            className={`toggle-btn ${days === p.days && !custom ? 'active' : ''}`}
            onClick={() => { setCustom(false); onChange(p.days) }}
          >
            {p.label}
          </button>
        ))}
        <button
          className={`toggle-btn ${custom ? 'active' : ''}`}
          onClick={() => setCustom(c => !c)}
        >
          Custom
        </button>
      </div>

      {custom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={fromDate}
            max={toDate || today}
            onChange={e => setFromDate(e.target.value)}
            style={inputStyle}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>→</span>
          <input
            type="date"
            value={toDate}
            max={today}
            onChange={e => setToDate(e.target.value)}
            style={inputStyle}
          />
          <button
            onClick={applyCustom}
            disabled={!fromDate}
            className="toggle-btn active"
            style={{ opacity: fromDate ? 1 : 0.4 }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}

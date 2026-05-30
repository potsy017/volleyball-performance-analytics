import { useState, useRef, useEffect } from 'react'

/**
 * Reusable dark-styled dropdown — replaces native <select>.
 *
 * Props:
 *   options      – string[] OR { value: string, label: string }[]
 *   value        – string   current selected value ('' = placeholder shown)
 *   onChange     – (val: string) => void
 *   placeholder  – string   label shown when value === ''
 *   minWidth     – number | string (default 160)
 */
export default function SelectDropdown({
  options = [],
  value = '',
  onChange,
  placeholder = 'All',
  minWidth = 160,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Normalise options to { value, label } regardless of input format
  const normalised = options.map(opt =>
    typeof opt === 'string'
      ? { value: opt, label: opt }
      : { value: String(opt.value ?? ''), label: String(opt.label ?? opt.value ?? '') }
  )

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Display label for the trigger button
  const activeOption = normalised.find(o => o.value === value)
  const triggerLabel = activeOption ? activeOption.label : (value || placeholder)

  return (
    <div ref={ref} style={{ position: 'relative', minWidth, flexShrink: 0 }}>
      {/* Trigger button */}
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
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '180px',
        }}>
          {triggerLabel}
        </span>
        <span style={{
          fontSize: '10px',
          color: 'var(--text-secondary)',
          transition: 'transform 0.15s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          flexShrink: 0,
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
          maxHeight: '320px',
          overflowY: 'auto',
        }}>
          {/* Placeholder row — only show when placeholder makes sense (value can be '') */}
          {placeholder && (
            <div
              onClick={() => { onChange(''); setOpen(false) }}
              style={{
                padding: '9px 14px',
                fontSize: '13px',
                cursor: 'pointer',
                color: !value ? 'var(--primary)' : 'var(--text-secondary)',
                background: !value ? 'rgba(200,230,0,0.08)' : 'transparent',
                borderBottom: '1px solid var(--border)',
                transition: 'background 0.1s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = !value ? 'rgba(200,230,0,0.08)' : 'transparent'}
            >
              {placeholder}
            </div>
          )}

          {/* Option rows */}
          {normalised.map(opt => {
            const isActive = value === opt.value
            return (
              <div
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                style={{
                  padding: '9px 14px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  color: isActive ? 'var(--primary)' : 'var(--text-primary)',
                  background: isActive ? 'rgba(200,230,0,0.08)' : 'transparent',
                  transition: 'background 0.1s',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = isActive ? 'rgba(200,230,0,0.08)' : 'transparent'}
              >
                {opt.label}
              </div>
            )
          })}

          {normalised.length === 0 && (
            <div style={{
              padding: '10px 14px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}>
              No options available
            </div>
          )}
        </div>
      )}
    </div>
  )
}

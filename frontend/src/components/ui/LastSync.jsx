/**
 * LastSync — shows a green dot + "Data last updated: DD Mon YYYY"
 * Pass any data array fetched from the API; it finds the most recent date.
 */
export default function LastSync({ data = [] }) {
  const dates = data
    .flatMap(r => [r.calendar_date, r.session_date])
    .filter(Boolean)
    .sort()
    .reverse()

  const latest = dates[0]
  if (!latest) return null

  const formatted = new Date(latest + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      fontSize: '11px', color: 'var(--text-muted)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: '7px', height: '7px', borderRadius: '50%',
        background: '#4CAF50', display: 'inline-block', flexShrink: 0,
      }} />
      Data last updated: <strong style={{ color: 'var(--text-secondary)' }}>{formatted}</strong>
    </div>
  )
}

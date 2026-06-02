export default function StatusBadge({ label, tone = 'neutral', title = '' }) {
  return (
    <span className={`badge badge-${tone}`} title={title || undefined}>
      {label}
    </span>
  )
}

export function recoveryBadge(score) {
  if (score == null) {
    return {
      label: 'Insufficient Data',
      tone: 'neutral',
      title: 'No recovery score available',
    }
  }
  if (score >= 67) return { label: 'Good', tone: 'green' }
  if (score >= 34) return { label: 'Monitor', tone: 'amber' }
  return { label: 'Low', tone: 'red' }
}

export function acwrBadge(status, value) {
  const toneMap = { green: 'green', amber: 'amber', red: 'red', gray: 'neutral' }
  const tone = toneMap[status] || 'neutral'
  if (value == null) {
    return { label: 'Insufficient Data', tone: 'neutral', title: 'No ACWR value available' }
  }
  return { label: value.toFixed(2), tone }
}

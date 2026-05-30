import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

export const DUAL_METRICS = [
  { key: 'total_player_load',      label: 'Player Load',     color: '#4CAF50', unit: 'AU' },
  { key: 'player_load_per_minute', label: 'Load / min',      color: '#C8E600', unit: 'AU/min' },
  { key: 'high_jump_count',        label: 'High Jumps',      color: '#F5C400', unit: '' },
  { key: 'hrv_rmssd_milli',        label: 'HRV',             color: '#2196F3', unit: 'ms' },
  { key: 'recovery_score',         label: 'Recovery Score',  color: '#9C27B0', unit: '%' },
  { key: 'resting_heart_rate',     label: 'Resting HR',      color: '#F44336', unit: 'bpm' },
  { key: 'cycle_strain',           label: 'WHOOP Strain',    color: '#FF9800', unit: '' },
]

const CustomTooltip = ({ active, payload, label, pm, sm }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1A1D24', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px', padding: '10px 14px', fontSize: '12px',
    }}>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 6px' }}>{label}</p>
      {payload.map((p, i) => {
        const meta = p.dataKey === pm?.key ? pm : sm
        return (
          <p key={i} style={{ color: p.color, margin: '2px 0', fontWeight: 500 }}>
            {meta?.label ?? p.name}:{' '}
            {typeof p.value === 'number' ? p.value.toFixed(1) : '—'}
            {meta?.unit ? ` ${meta.unit}` : ''}
          </p>
        )
      })}
    </div>
  )
}

/**
 * DualAxisChart — bars on primary (left) Y axis, line on secondary (right) Y axis.
 * Props:
 *   data          — merged array with session_date + metric keys
 *   primaryKey    — metric key for bars
 *   secondaryKey  — metric key for line (null = line hidden)
 *   height        — chart height in px (default 280)
 */
export default function DualAxisChart({ data = [], primaryKey, secondaryKey = null, height = 280 }) {
  const pm = DUAL_METRICS.find(m => m.key === primaryKey)
  const sm = secondaryKey ? DUAL_METRICS.find(m => m.key === secondaryKey) : null

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: sm ? 50 : 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="session_date"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false} tickLine={false}
          tickFormatter={v => v ? String(v).slice(5) : ''}
        />
        {/* Primary (left) Y axis */}
        <YAxis
          yAxisId="primary"
          tick={{ fill: pm?.color ?? 'var(--text-muted)', fontSize: 11 }}
          axisLine={false} tickLine={false}
          width={46}
        />
        {/* Secondary (right) Y axis — only shown when a second metric is selected */}
        {sm && (
          <YAxis
            yAxisId="secondary"
            orientation="right"
            tick={{ fill: sm.color, fontSize: 11 }}
            axisLine={false} tickLine={false}
            width={46}
          />
        )}
        <Tooltip content={<CustomTooltip pm={pm} sm={sm} />} />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)', paddingTop: '12px' }}
          formatter={(value, entry) => {
            const meta = entry.dataKey === pm?.key ? pm : sm
            return <span style={{ color: entry.color }}>{meta?.label ?? value}</span>
          }}
        />
        {/* Bars — primary metric */}
        {pm && (
          <Bar
            yAxisId="primary"
            dataKey={primaryKey}
            name={pm.label}
            fill={pm.color}
            opacity={0.85}
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
          />
        )}
        {/* Line — secondary metric */}
        {sm && (
          <Line
            yAxisId="secondary"
            type="monotone"
            dataKey={secondaryKey}
            name={sm.label}
            stroke={sm.color}
            strokeWidth={2.5}
            dot={{ r: 3, fill: sm.color, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: sm.color }}
            connectNulls
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

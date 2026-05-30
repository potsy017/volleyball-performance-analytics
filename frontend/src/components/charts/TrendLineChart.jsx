import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1A1D24', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px', padding: '10px 14px', fontSize: '12px',
    }}>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 6px' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '2px 0', fontWeight: 500 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  )
}

/**
 * referenceLine  — optional { value, label, color }   single horizontal line (backward-compat)
 * referenceLines — optional [{ value, label, color }] multiple horizontal lines (e.g. ACWR bounds)
 * Both can coexist; referenceLines takes precedence when provided.
 */
export default function TrendLineChart({
  data = [],
  lines = [],
  xKey = 'session_date',
  height = 240,
  referenceLine = null,
  referenceLines = [],
}) {
  // Normalise to a single array so rendering loop is simple
  const allRefLines = referenceLines.length
    ? referenceLines
    : referenceLine
    ? [referenceLine]
    : []

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey={xKey}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => v ? String(v).slice(5) : ''}
        />
        <YAxis
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)', paddingTop: '12px' }} />

        {allRefLines.map((rl, i) => (
          <ReferenceLine
            key={i}
            y={rl.value}
            stroke={rl.color || 'rgba(255,255,255,0.3)'}
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{
              value: rl.label || `${rl.value}`,
              position: i % 2 === 0 ? 'insideTopRight' : 'insideBottomRight',
              fill: rl.color || 'rgba(255,255,255,0.4)',
              fontSize: 10,
            }}
          />
        ))}

        {lines.map(({ key, name, color, dashed }) => (
          <Line
            key={key}
            dataKey={key}
            name={name}
            stroke={color}
            strokeWidth={2}
            strokeDasharray={dashed ? '5 3' : undefined}
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

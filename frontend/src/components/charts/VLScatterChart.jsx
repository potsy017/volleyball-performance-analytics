import {
  ComposedChart, Scatter, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload
  if (p?.load == null) return null
  return (
    <div style={{
      background: '#1A1D24', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px', padding: '10px 14px', fontSize: '12px',
    }}>
      <p style={{ color: '#C8E600', margin: '0 0 4px', fontWeight: 500 }}>
        Load: {p.load} kg
      </p>
      <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
        Peak Vel: {p.velocity?.toFixed(3)} m/s
      </p>
    </div>
  )
}

/**
 * VLScatterChart
 * Shows load (x-axis) vs peak velocity (y-axis) for one session,
 * with the fitted regression line overlaid.
 *
 * Props:
 *   points  — [{ load, velocity }]
 *   v0      — velocity at load = 0 (Y-intercept)
 *   l0      — load at velocity = 0 (X-intercept)
 *   r2      — R² of the fit (displayed as info)
 *   nSets   — number of sets used
 *   height  — chart height in px (default 240)
 */
export default function VLScatterChart({ points = [], v0, l0, r2, nSets, height = 240 }) {
  if (!points.length || v0 == null) return null

  const maxLoad = Math.max(...points.map(p => p.load))
  const xEnd    = l0 != null ? Math.max(l0 * 1.05, maxLoad * 1.15) : maxLoad * 1.3
  const xStart  = 0

  // Sample the regression line across the range
  const regressionLine = Array.from({ length: 30 }, (_, i) => {
    const load = xStart + (xEnd - xStart) * (i / 29)
    // Slope from the two intercepts: slope = (0 - v0) / (l0 - 0)
    const slope    = l0 != null ? (0 - v0) / (l0 - xStart) : 0
    const velocity = Math.max(0, v0 + slope * load)
    return { load: Math.round(load * 10) / 10, velocity: Math.round(velocity * 1000) / 1000 }
  })

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart margin={{ top: 8, right: 20, bottom: 30, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          type="number"
          dataKey="load"
          name="Load (kg)"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false} tickLine={false}
          domain={[0, Math.ceil(xEnd / 10) * 10]}
          label={{ value: 'Load (kg)', position: 'insideBottom', fill: 'var(--text-muted)', fontSize: 11, offset: -16 }}
        />
        <YAxis
          type="number"
          dataKey="velocity"
          name="Peak Velocity (m/s)"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false} tickLine={false}
          domain={[0, 'dataMax + 0.4']}
          width={44}
          tickFormatter={v => v.toFixed(1)}
        />
        <Tooltip content={<CustomTooltip />} />

        {/* Regression line */}
        <Line
          data={regressionLine}
          dataKey="velocity"
          stroke="rgba(200,230,0,0.55)"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          dot={false}
          isAnimationActive={false}
          legendType="none"
        />

        {/* V0 marker — dashed horizontal line at load=0, vel=V0 */}
        <ReferenceLine
          y={v0}
          stroke="rgba(200,230,0,0.35)"
          strokeDasharray="3 3"
          label={{ value: `V0: ${v0?.toFixed(2)} m/s`, position: 'insideTopLeft', fill: 'rgba(200,230,0,0.7)', fontSize: 10 }}
        />

        {/* Actual set data points */}
        <Scatter
          data={points}
          fill="#C8E600"
          opacity={0.9}
          r={5}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

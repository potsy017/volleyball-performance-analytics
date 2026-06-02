import { useMemo } from 'react'
import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'

const SESSION_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#AB47BC', '#EF5350', '#26C6DA', '#F5C400', '#8D6E63',
  '#00BCD4', '#E91E63', '#8BC34A', '#3F51B5',
]

const PB_COLOR = '#FFD54F'
const PB_LINE = 'rgba(255, 213, 79, 0.85)'

const tooltipStyle = {
  background: '#1A1D24',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  padding: '10px 14px',
  fontSize: '12px',
}

export function sessionLabel(dateStr) {
  if (!dateStr) return 'Session'
  const s = String(dateStr)
  if (s.length >= 10) return s.slice(8, 10) + '/' + s.slice(5, 7)
  return s
}

function opacityForIndex(i, total) {
  if (total <= 4) return 1
  const t = i / Math.max(total - 1, 1)
  return 0.45 + t * 0.55
}

export default function LoadVelocityMultiProfileChart({
  sessionProfiles = [],
  pbBenchmark = null,
  height = 420,
  maxSessions = null,
  extrapolate = true,
  showPb = true,
  connectObservedOnly = false,
}) {
  const filteredProfiles = useMemo(() => {
    const sorted = [...(sessionProfiles || [])]
      .filter(s => (s.observed?.length ?? 0) > 0)
      .sort((a, b) => String(a.session_date).localeCompare(String(b.session_date)))
    if (maxSessions != null && maxSessions > 0 && sorted.length > maxSessions) {
      return sorted.slice(-maxSessions)
    }
    return sorted
  }, [sessionProfiles, maxSessions])

  const series = useMemo(() => {
    const total = filteredProfiles.length
    return filteredProfiles.map((s, i) => {
      const color = SESSION_COLORS[i % SESSION_COLORS.length]
      const op = opacityForIndex(i, total)
      const observedSorted = [...(s.observed || [])].sort((a, b) => a.bar_weight - b.bar_weight)
      return {
        date: s.session_date,
        color,
        opacity: op,
        label: sessionLabel(s.session_date),
        hasProfileLine: extrapolate && (s.fixed_profile?.length ?? 0) >= 2,
        profilePoints: (s.fixed_profile || []).map(p => ({
          x: p.bar_weight,
          y: p.velocity,
          session_date: s.session_date,
          kind: 'session_line',
        })),
        observedPoints: observedSorted.map(p => ({
          x: p.bar_weight,
          y: p.mean_peak_velocity,
          session_date: s.session_date,
          rep_count: p.rep_count,
          kind: 'session_observed',
        })),
      }
    })
  }, [filteredProfiles, extrapolate])

  const yDomain = useMemo(() => {
    const ys = []
    series.forEach(s => {
      s.observedPoints.forEach(p => ys.push(p.y))
      if (showPb) {
        ;(pbBenchmark?.by_load || []).forEach(p => ys.push(p.pb_peak_velocity))
      }
    })
    if (!ys.length) return [0, 4]
    const lo = Math.min(...ys)
    const hi = Math.max(...ys)
    return [Math.max(0, lo - 0.35), hi + 0.35]
  }, [series, pbBenchmark, showPb])

  const xDomain = useMemo(() => {
    const xs = []
    series.forEach(s => s.observedPoints.forEach(p => xs.push(p.x)))
    if (!xs.length) return [20, 110]
    const lo = Math.min(...xs)
    const hi = Math.max(...xs)
    const pad = Math.max(8, (hi - lo) * 0.12)
    return [Math.max(15, lo - pad), Math.min(130, hi + pad)]
  }, [series])

  const pbLinePoints = useMemo(() => {
    if (!showPb) return []
    return (pbBenchmark?.fixed_profile || []).map(p => ({
      x: p.bar_weight,
      y: p.velocity,
      kind: 'pb_line',
      session_date: 'Personal best',
    }))
  }, [pbBenchmark, showPb])

  const pbLoadPoints = useMemo(() => {
    if (!showPb) return []
    return (pbBenchmark?.by_load || []).map(p => ({
      x: p.bar_weight,
      y: p.pb_peak_velocity,
      kind: 'pb_load',
      session_date: 'PB (peak) at load',
    }))
  }, [pbBenchmark, showPb])

  const bestPeak = showPb ? pbBenchmark?.best_peak : null
  const totalSessions = (sessionProfiles || []).filter(s => s.observed?.length).length
  const hiddenCount = totalSessions - filteredProfiles.length

  if (!series.length && !(showPb && pbLoadPoints.length)) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5 }}>
        No load–velocity data in this window.
      </div>
    )
  }

  const allSessionObserved = series.flatMap(s =>
    s.observedPoints.map(p => ({ ...p, fill: s.color, fillOpacity: s.opacity, seriesLabel: s.label }))
  )

  const showExtrapolated = extrapolate && !connectObservedOnly

  return (
    <div>
      {hiddenCount > 0 && (
        <p style={{ fontSize: '11px', color: '#F5C400', marginBottom: '10px', lineHeight: 1.45 }}>
          Showing the most recent {filteredProfiles.length} of {totalSessions} sessions.
          Older sessions are hidden to reduce clutter — change &quot;Sessions shown&quot; above to compare specific dates.
        </p>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart margin={{ top: 16, right: 20, bottom: 32, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            type="number"
            dataKey="x"
            domain={xDomain}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: 'Load (kg)',
              position: 'insideBottom',
              offset: -20,
              fill: 'var(--text-secondary)',
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={yDomain}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={v => Number(v).toFixed(1)}
            label={{
              value: 'Peak velocity (m/s)',
              angle: -90,
              position: 'insideLeft',
              fill: 'var(--text-secondary)',
              fontSize: 11,
              dx: 10,
            }}
          />

          {showPb && pbBenchmark?.vmax != null && (
            <ReferenceLine
              y={pbBenchmark.vmax}
              stroke={PB_LINE}
              strokeDasharray="8 4"
              label={{
                value: `PB Vmax ${pbBenchmark.vmax} m/s`,
                position: 'insideTopRight',
                fill: PB_COLOR,
                fontSize: 10,
              }}
            />
          )}
          {showPb && pbBenchmark?.lmax != null && pbBenchmark.lmax > 0 && pbBenchmark.lmax < 150 && (
            <ReferenceLine
              x={pbBenchmark.lmax}
              stroke={PB_LINE}
              strokeDasharray="8 4"
              label={{
                value: `PB Lmax ${pbBenchmark.lmax} kg`,
                position: 'insideTopLeft',
                fill: PB_COLOR,
                fontSize: 10,
              }}
            />
          )}

          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0]?.payload
              const isPb = String(p?.kind || '').startsWith('pb')
              return (
                <div style={tooltipStyle}>
                  <p style={{ color: isPb ? PB_COLOR : 'var(--text-secondary)', margin: '0 0 4px', fontWeight: 600 }}>
                    {isPb ? p.session_date : p.seriesLabel || sessionLabel(p.session_date)}
                  </p>
                  <p style={{ margin: '2px 0' }}>{p?.x} kg · {p?.y?.toFixed(2)} m/s</p>
                  {!isPb && p?.rep_count != null && (
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '11px' }}>
                      {p.rep_count} set{p.rep_count !== 1 ? 's' : ''} averaged at this load
                    </p>
                  )}
                </div>
              )
            }}
          />
          <Legend wrapperStyle={{ fontSize: '10px', paddingTop: 10 }} iconSize={10} />

          {showPb && pbLinePoints.length >= 2 && (
            <Line
              data={pbLinePoints}
              type="linear"
              dataKey="y"
              name="PB profile (peak)"
              stroke={PB_COLOR}
              strokeWidth={2.5}
              strokeDasharray="2 6"
              dot={false}
              isAnimationActive={false}
            />
          )}

          {showPb && pbLoadPoints.length > 0 && (
            <Scatter
              data={pbLoadPoints}
              dataKey="y"
              name="PB peak at load"
              fill={PB_COLOR}
              legendType="star"
              isAnimationActive={false}
              shape="star"
            />
          )}

          {showPb && bestPeak && (
            <Scatter
              data={[{
                x: bestPeak.bar_weight,
                y: bestPeak.peak_velocity,
                session_date: 'Best PB peak',
                kind: 'pb_best',
              }]}
              dataKey="y"
              name={`Best peak ${bestPeak.peak_velocity} m/s @ ${bestPeak.bar_weight} kg`}
              fill="#FFFFFF"
              stroke={PB_COLOR}
              strokeWidth={2}
              legendType="star"
              isAnimationActive={false}
              shape="star"
            />
          )}

          {allSessionObserved.length > 0 && (
            <Scatter
              data={allSessionObserved}
              dataKey="y"
              legendType="none"
              isAnimationActive={false}
              shape={(props) => {
                const { cx, cy, payload } = props
                if (cx == null || cy == null) return null
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill={payload.fill}
                    fillOpacity={payload.fillOpacity ?? 1}
                    stroke="#0A0B0E"
                    strokeWidth={1.5}
                  />
                )
              }}
            />
          )}

          {series.map(s => {
            const lineData = showExtrapolated ? s.profilePoints : s.observedPoints
            const canLine = showExtrapolated ? s.hasProfileLine : s.observedPoints.length >= 2
            if (!canLine) {
              return (
                <Line
                  key={`dot-${s.date}`}
                  data={s.observedPoints}
                  type="linear"
                  dataKey="y"
                  name={s.label}
                  stroke="transparent"
                  strokeWidth={0}
                  dot={{ r: 6, fill: s.color, fillOpacity: s.opacity, strokeWidth: 0 }}
                  legendType="line"
                  isAnimationActive={false}
                />
              )
            }
            return (
              <Line
                key={`line-${s.date}`}
                data={lineData}
                type="monotone"
                dataKey="y"
                name={s.label}
                stroke={s.color}
                strokeOpacity={s.opacity}
                strokeWidth={2}
                strokeDasharray={showExtrapolated ? '6 4' : undefined}
                dot={showExtrapolated ? false : { r: 5, fill: s.color, fillOpacity: s.opacity }}
                connectNulls
                isAnimationActive={false}
                legendType="line"
              />
            )
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

import { useMemo } from 'react'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'

const tooltipStyle = {
  background: '#1A1D24',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  padding: '10px 14px',
  fontSize: '12px',
}

const VEL_COLOR = '#C8E600'
const LMAX_COLOR = '#2196F3'
const PB_COLOR = '#FFD54F'

function fmtDate(d) {
  if (!d) return ''
  const s = String(d)
  return s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : s
}

/**
 * Session-by-session progression: velocity (left) and Lmax (right) per training date.
 */
export default function LoadVelocityProgressChart({
  sessionProfiles = [],
  pbBenchmark = null,
  height = 280,
}) {
  const data = useMemo(() => {
    return (sessionProfiles || [])
      .filter(s => (s.observed?.length ?? 0) > 0)
      .map(s => {
        const peaks = s.observed.map(o => o.mean_peak_velocity).filter(v => v != null)
        const loads = s.observed.map(o => o.bar_weight).filter(v => v != null)
        const sessionPeak = peaks.length ? Math.max(...peaks) : null
        return {
          session_date: s.session_date,
          label: fmtDate(s.session_date),
          session_peak: sessionPeak,
          vmax: s.vmax ?? null,
          lmax: s.lmax ?? null,
          n_loads: loads.length,
          load_min: loads.length ? Math.min(...loads) : null,
          load_max: loads.length ? Math.max(...loads) : null,
        }
      })
      .sort((a, b) => String(a.session_date).localeCompare(String(b.session_date)))
  }, [sessionProfiles])

  const pbPeak = pbBenchmark?.best_peak?.peak_velocity
  const pbLmax = pbBenchmark?.lmax

  const hasLmax = data.some(d => d.lmax != null)

  if (!data.length) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        No sessions in range for progression view.
      </div>
    )
  }

  return (
    <div>
      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.45 }}>
        <strong>Left axis (m/s):</strong> bars = best peak velocity that session; green line = Vmax from that
        day&apos;s load–velocity fit (≥2 loads).
        {hasLmax && (
          <>
            {' '}
            <strong>Right axis (kg):</strong> blue line = Lmax (theoretical max load at zero velocity) per session.
          </>
        )}
        {(pbPeak != null || pbLmax != null) && (
          <> Gold guides = all-time PB {pbPeak != null ? `peak ${pbPeak} m/s` : ''}{pbPeak != null && pbLmax != null ? '; ' : ''}{pbLmax != null ? `Lmax ${pbLmax} kg` : ''}.</>
        )}
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 12, right: hasLmax ? 48 : 12, bottom: 8, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={data.length > 8 ? Math.floor(data.length / 8) : 0}
            angle={data.length > 6 ? -35 : 0}
            textAnchor={data.length > 6 ? 'end' : 'middle'}
            height={data.length > 6 ? 48 : 30}
          />
          <YAxis
            yAxisId="velocity"
            domain={['auto', 'auto']}
            tick={{ fill: VEL_COLOR, fontSize: 11 }}
            width={42}
            tickFormatter={v => Number(v).toFixed(1)}
            label={{
              value: 'Velocity (m/s)',
              angle: -90,
              position: 'insideLeft',
              fill: 'var(--text-secondary)',
              fontSize: 10,
              dx: 6,
            }}
          />
          {hasLmax && (
            <YAxis
              yAxisId="load"
              orientation="right"
              domain={['auto', 'auto']}
              tick={{ fill: LMAX_COLOR, fontSize: 11 }}
              width={44}
              tickFormatter={v => Math.round(Number(v))}
              label={{
                value: 'Lmax (kg)',
                angle: 90,
                position: 'insideRight',
                fill: LMAX_COLOR,
                fontSize: 10,
                dx: 8,
              }}
            />
          )}

          {pbPeak != null && (
            <ReferenceLine
              yAxisId="velocity"
              y={pbPeak}
              stroke="rgba(255, 213, 79, 0.7)"
              strokeDasharray="6 4"
              label={{
                value: `PB Vmax ${pbPeak}`,
                fill: PB_COLOR,
                fontSize: 10,
                position: 'insideTopRight',
              }}
            />
          )}
          {hasLmax && pbLmax != null && pbLmax > 0 && pbLmax < 300 && (
            <ReferenceLine
              yAxisId="load"
              y={pbLmax}
              stroke="rgba(255, 213, 79, 0.55)"
              strokeDasharray="6 4"
              label={{
                value: `PB Lmax ${pbLmax} kg`,
                fill: PB_COLOR,
                fontSize: 10,
                position: 'insideBottomRight',
              }}
            />
          )}

          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0]?.payload
              return (
                <div style={tooltipStyle}>
                  <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{p.session_date}</p>
                  {p.session_peak != null && (
                    <p style={{ margin: '2px 0', color: VEL_COLOR }}>
                      Best peak: {p.session_peak.toFixed(2)} m/s
                    </p>
                  )}
                  {p.vmax != null && (
                    <p style={{ margin: '2px 0', color: VEL_COLOR }}>Vmax: {p.vmax.toFixed(2)} m/s</p>
                  )}
                  {p.lmax != null && (
                    <p style={{ margin: '2px 0', color: LMAX_COLOR }}>Lmax: {p.lmax.toFixed(1)} kg</p>
                  )}
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '11px' }}>
                    {p.n_loads} load{p.n_loads !== 1 ? 's' : ''} ({p.load_min}–{p.load_max} kg)
                    {p.n_loads < 2 && ' · Lmax/Vmax need ≥2 loads'}
                  </p>
                </div>
              )
            }}
          />
          <Legend wrapperStyle={{ fontSize: '10px', paddingTop: 8 }} iconSize={10} />

          <Bar
            yAxisId="velocity"
            dataKey="session_peak"
            name="Session best peak (m/s)"
            fill="rgba(76, 175, 80, 0.35)"
            radius={[3, 3, 0, 0]}
          />
          <Line
            yAxisId="velocity"
            type="monotone"
            dataKey="vmax"
            name="Vmax (m/s)"
            stroke={VEL_COLOR}
            strokeWidth={2}
            dot={{ r: 3, fill: VEL_COLOR }}
            connectNulls
            isAnimationActive={false}
          />
          {hasLmax && (
            <Line
              yAxisId="load"
              type="monotone"
              dataKey="lmax"
              name="Lmax (kg)"
              stroke={LMAX_COLOR}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={{ r: 4, fill: LMAX_COLOR }}
              connectNulls
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      {!hasLmax && (
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
          Lmax appears when a session has at least two different loads (regression needs ≥2 points).
        </p>
      )}
    </div>
  )
}

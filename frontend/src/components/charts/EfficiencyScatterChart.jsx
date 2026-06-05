import { useMemo } from 'react'
import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Legend,
} from 'recharts'
import { CHART_CONTINUITY } from './chartDefaults'

function EfficiencyTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload.find((x) => x.payload?.player_load != null)?.payload
  if (!p) return null
  return (
    <div
      style={{
        background: '#1A1D24',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '8px',
        padding: '10px 14px',
        fontSize: '12px',
      }}
    >
      <p style={{ color: '#9ca3af', margin: '0 0 4px' }}>{p.calendar_date}</p>
      {p.activity_name && (
        <p style={{ color: '#9ca3af', margin: '0 0 6px', fontSize: '11px' }}>
          {p.activity_name}
        </p>
      )}
      <p style={{ color: '#4CAF50', margin: '2px 0' }}>
        Player load: {p.player_load} AU
      </p>
      <p style={{ color: '#FF9800', margin: '2px 0' }}>
        WHOOP strain: {p.strain}
      </p>
      <p style={{ color: '#e5e7eb', margin: '6px 0 0', fontWeight: 600 }}>
        Efficiency: {p.efficiency_index} AU / strain
      </p>
      {p.zone === 'peaking' && (
        <p style={{ color: '#60a5fa', margin: '4px 0 0' }}>Peaking (below baseline)</p>
      )}
      {p.zone === 'fatigued' && (
        <p style={{ color: '#f87171', margin: '4px 0 0' }}>Fatigued (above baseline)</p>
      )}
    </div>
  )
}

/**
 * Quadrant scatter: Catapult load (X) vs WHOOP cycle strain (Y) + 30d efficiency trendline.
 */
export default function EfficiencyScatterChart({
  data = null,
  loading = false,
  height = 360,
}) {
  const sessions = data?.sessions ?? []
  const trendLine = data?.trend_line ?? []
  const baseline = data?.baseline ?? {}

  const { xDomain, yDomain } = useMemo(() => {
    const loads = sessions.map((s) => s.player_load).filter((v) => v != null)
    const strains = sessions.map((s) => s.strain).filter((v) => v != null)
    const xMax = loads.length ? Math.max(...loads) * 1.12 : 500
    const yMax = strains.length ? Math.max(...strains) * 1.15 : 20
    return {
      xDomain: [0, Math.ceil(xMax / 50) * 50],
      yDomain: [0, Math.ceil(yMax)],
    }
  }, [sessions])

  if (loading) {
    return (
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
        Loading efficiency scatter…
      </p>
    )
  }

  if (!data) {
    return (
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
        Select an athlete to view internal vs external efficiency.
      </p>
    )
  }

  if (!sessions.length) {
    return (
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
        No sessions with both Catapult player load and WHOOP cycle strain in the last{' '}
        {data.days} days. WHOOP must be linked for this athlete.
      </p>
    )
  }

  const recentCount = sessions.filter((s) => s.is_recent).length
  const fatiguedRecent = sessions.filter((s) => s.is_recent && s.zone === 'fatigued')

  return (
    <div>
      {fatiguedRecent.length > 0 && (
        <div
          role="alert"
          style={{
            marginBottom: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(220, 38, 38, 0.12)',
            border: '1px solid rgba(220, 38, 38, 0.4)',
            color: '#fca5a5',
            fontSize: '12px',
          }}
        >
          Recent sessions ({fatiguedRecent.length}) are trending{' '}
          <strong>above</strong> the efficiency baseline: high strain for low court
          load. Review readiness before heavy training.
        </div>
      )}

      <div
        style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          marginBottom: '10px',
        }}
      >
        {sessions.length} sessions · baseline efficiency{' '}
        {baseline.avg_efficiency_index ?? '—'} AU/strain (load ÷ strain, 30d avg)
        {recentCount > 0 ? ` · ${recentCount} recent (solid blue)` : ''}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart margin={{ top: 12, right: 24, bottom: 28, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            type="number"
            dataKey="player_load"
            name="Player Load"
            domain={xDomain}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: 'Catapult player load (external)',
              position: 'insideBottom',
              offset: -18,
              fill: '#9ca3af',
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="strain"
            name="Strain"
            domain={yDomain}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={42}
            label={{
              value: 'WHOOP strain (internal)',
              angle: -90,
              position: 'insideLeft',
              fill: '#9ca3af',
              fontSize: 11,
            }}
          />
          {baseline.avg_player_load != null && (
            <ReferenceLine
              x={baseline.avg_player_load}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="3 3"
            />
          )}
          {baseline.avg_strain != null && (
            <ReferenceLine
              y={baseline.avg_strain}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="3 3"
            />
          )}
          {trendLine.length >= 2 && (
            <Line
              data={trendLine}
              type="linear"
              dataKey="strain"
              stroke="#a78bfa"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              legendType="none"
              isAnimationActive={false}
              {...CHART_CONTINUITY}
            />
          )}
          <Tooltip content={<EfficiencyTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter
            name="Sessions"
            data={sessions}
            fill="#3b82f6"
            legendType="circle"
          >
            {sessions.map((entry) => (
              <Cell
                key={`${entry.calendar_date}-${entry.player_load}-${entry.strain}`}
                fill={entry.is_recent ? '#3b82f6' : 'rgba(148, 163, 184, 0.38)'}
                stroke={entry.is_recent ? '#93c5fd' : 'rgba(148, 163, 184, 0.55)'}
                strokeWidth={entry.zone === 'fatigued' && entry.is_recent ? 2 : 1}
              />
            ))}
          </Scatter>
          <Legend
            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            payload={[
              { value: 'Last 3 days', type: 'circle', color: '#3b82f6' },
              { value: 'Older sessions', type: 'circle', color: 'rgba(148,163,184,0.5)' },
              { value: '30d efficiency baseline', type: 'line', color: '#a78bfa' },
            ]}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          marginTop: '14px',
          fontSize: '11px',
          color: 'var(--text-secondary)',
        }}
      >
        <div
          style={{
            padding: '10px',
            borderRadius: '8px',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}
        >
          <strong style={{ color: '#93c5fd' }}>Below the line → Peaking</strong>
          <br />
          High court load, lower strain than this athlete&apos;s norm: mechanical
          efficiency is strong.
        </div>
        <div
          style={{
            padding: '10px',
            borderRadius: '8px',
            background: 'rgba(220, 38, 38, 0.08)',
            border: '1px solid rgba(220, 38, 38, 0.2)',
          }}
        >
          <strong style={{ color: '#fca5a5' }}>Above the line → Fatigued</strong>
          <br />
          Low load but high cardiovascular cost. Blue dots drifting top-left need
          recovery.
        </div>
      </div>
    </div>
  )
}

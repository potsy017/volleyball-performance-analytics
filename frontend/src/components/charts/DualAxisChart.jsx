import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

export const DUAL_METRICS = [
  // ── Catapult ──────────────────────────────────────────────────
  { key: 'total_player_load',               label: 'Player Load',        color: '#4CAF50', unit: 'AU'    },
  { key: 'player_load_per_minute',          label: 'Load / min',         color: '#C8E600', unit: 'AU/min'},
  { key: 'high_jump_count',                 label: 'High Jumps',         color: '#F5C400', unit: ''      },
  { key: 'total_distance',                  label: 'Total Distance',     color: '#00BCD4', unit: 'm'     },
  // ── Workload ratios ───────────────────────────────────────────
  { key: 'acute_load',                      label: 'Acute Load (7d)',    color: '#FF9800', unit: 'AU/d'  },
  { key: 'chronic_load',                    label: 'Chronic Load (28d)', color: '#8BC34A', unit: 'AU/d'  },
  { key: 'acwr',                            label: 'ACWR',               color: '#FF5722', unit: ''      },
  // ── WHOOP recovery ────────────────────────────────────────────
  { key: 'hrv_rmssd_milli',                 label: 'HRV',                color: '#2196F3', unit: 'ms'   },
  { key: 'recovery_score',                  label: 'Recovery Score',     color: '#9C27B0', unit: '%'     },
  { key: 'resting_heart_rate',              label: 'Resting HR',         color: '#F44336', unit: 'bpm'  },
  { key: 'cycle_strain',                    label: 'WHOOP Strain',       color: '#FF9800', unit: ''      },
  // ── WHOOP sleep ───────────────────────────────────────────────
  { key: 'sleep_performance_percentage',    label: 'Sleep Performance',  color: '#7E57C2', unit: '%'     },
]

function metaForKey(key, pm, sm, tm) {
  if (key === pm?.key) return pm
  if (key === sm?.key) return sm
  if (key === tm?.key) return tm
  return DUAL_METRICS.find(m => m.key === key)
}

const CustomTooltip = ({ active, payload, label, pm, sm, tm }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1A1D24', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px', padding: '10px 14px', fontSize: '12px',
    }}>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 6px' }}>{label}</p>
      {payload.map((p, i) => {
        const meta = metaForKey(p.dataKey, pm, sm, tm)
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
 * Multi-metric chart — up to 3 independent Y axes.
 * Primary (left): bars. Secondary & tertiary (right): lines on separate scales.
 */
export default function DualAxisChart({
  data = [],
  primaryKey,
  secondaryKey = null,
  tertiaryKey = null,
  height = 280,
}) {
  const pm = DUAL_METRICS.find(m => m.key === primaryKey)
  const sm = secondaryKey ? DUAL_METRICS.find(m => m.key === secondaryKey) : null
  const tm = tertiaryKey ? DUAL_METRICS.find(m => m.key === tertiaryKey) : null

  const rightMargin = tm ? 88 : sm ? 50 : 12

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: rightMargin, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="session_date"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false} tickLine={false}
          tickFormatter={v => v ? String(v).slice(5) : ''}
        />
        <YAxis
          yAxisId="primary"
          tick={{ fill: pm?.color ?? 'var(--text-muted)', fontSize: 11 }}
          axisLine={false} tickLine={false}
          width={46}
        />
        {sm && (
          <YAxis
            yAxisId="secondary"
            orientation="right"
            tick={{ fill: sm.color, fontSize: 11 }}
            axisLine={false} tickLine={false}
            width={42}
          />
        )}
        {tm && (
          <YAxis
            yAxisId="tertiary"
            orientation="right"
            tick={{ fill: tm.color, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
            offset={sm ? 48 : 0}
          />
        )}
        <Tooltip content={<CustomTooltip pm={pm} sm={sm} tm={tm} />} />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)', paddingTop: '12px' }}
          formatter={(value, entry) => {
            const meta = metaForKey(entry.dataKey, pm, sm, tm)
            return <span style={{ color: entry.color }}>{meta?.label ?? value}</span>
          }}
        />
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
        {tm && (
          <Line
            yAxisId="tertiary"
            type="monotone"
            dataKey={tertiaryKey}
            name={tm.label}
            stroke={tm.color}
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={{ r: 2, fill: tm.color, strokeWidth: 0 }}
            activeDot={{ r: 4, fill: tm.color }}
            connectNulls
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

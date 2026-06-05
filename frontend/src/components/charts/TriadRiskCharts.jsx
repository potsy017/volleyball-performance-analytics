import { useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts'
import { CHART_CONTINUITY } from './chartDefaults'

const SYNC_ID = 'triadRisk'
const RED_FILL = 'rgba(220, 38, 38, 0.22)'
const RED_STROKE = 'rgba(220, 38, 38, 0.55)'

function formatDay(v) {
  return v ? String(v).slice(5) : ''
}

function TriadTooltip({ active, payload, label, unit, riskKey }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  const val = payload[0]?.value
  const inRisk = row?.[riskKey]
  return (
    <div
      style={{
        background: '#1A1D24',
        border: `1px solid ${inRisk ? '#dc2626' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: '8px',
        padding: '10px 14px',
        fontSize: '12px',
      }}
    >
      <p style={{ color: '#9ca3af', margin: '0 0 4px' }}>{label}</p>
      <p style={{ color: inRisk ? '#f87171' : '#e5e7eb', margin: 0, fontWeight: 600 }}>
        {typeof val === 'number' ? val.toFixed(1) : '—'}
        {unit ? ` ${unit}` : ''}
        {inRisk ? ' · danger zone' : ''}
      </p>
      {row?.max_jump_height_cm != null && row?.high_band_ratio_pct != null && (
        <p style={{ color: '#9ca3af', margin: '6px 0 0', fontSize: '10px' }}>
          Max jump {row.max_jump_height_cm} cm · high-band {row.high_band_ratio_pct}%
        </p>
      )}
    </div>
  )
}

function TriadPanel({
  title,
  subtitle,
  data,
  dataKey,
  domain,
  riskKey,
  unit,
  yAxisWidth = 36,
  referenceArea,
  referenceLine,
  showXAxis = false,
  chartHeight = 128,
  onMouseMove,
  onMouseLeave,
}) {
  return (
    <div style={{ marginBottom: showXAxis ? 0 : 4 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 6,
          paddingLeft: 4,
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#e5e7eb' }}>
          {title}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{subtitle}</span>
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <AreaChart
          data={data}
          syncId={SYNC_ID}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          margin={{ top: 8, right: 12, bottom: showXAxis ? 4 : 0, left: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="calendar_date"
            tick={showXAxis ? { fill: '#9ca3af', fontSize: 10 } : false}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatDay}
            hide={!showXAxis}
          />
          <YAxis
            domain={domain}
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={yAxisWidth}
          />
          {referenceArea}
          {referenceLine}
          <Tooltip
            cursor={{
              stroke: 'rgba(255,255,255,0.45)',
              strokeWidth: 1,
              strokeDasharray: '4 4',
            }}
            content={<TriadTooltip unit={unit} riskKey={riskKey} />}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.35}
            strokeWidth={2}
            dot={{ r: 2, fill: '#3b82f6' }}
            activeDot={{ r: 4, fill: '#60a5fa', stroke: '#fff', strokeWidth: 1 }}
            {...CHART_CONTINUITY}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Triad: ACWR, WHOOP deep sleep, Catapult max jump decrement (or high-band ratio).
 */
export default function TriadRiskCharts({ triadData = null, loading = false }) {
  const [hoverDate, setHoverDate] = useState(null)

  const { series, thresholds, critical_dates: criticalDates } = triadData || {}
  const data = series || []

  const hoverRow = useMemo(
    () => data.find((r) => r.calendar_date === hoverDate),
    [data, hoverDate],
  )

  const acwrDomain = useMemo(() => {
    const vals = data.map((r) => r.acwr).filter((v) => v != null)
    const max = vals.length ? Math.max(...vals, 1.6) : 2
    return [0, Math.ceil(max * 10) / 10 + 0.2]
  }, [data])

  const sleepDomain = useMemo(() => {
    const vals = data.map((r) => r.deep_sleep_hours).filter((v) => v != null)
    const max = vals.length ? Math.max(...vals, thresholds?.deep_sleep_min_hours ?? 1) : 3
    return [0, Math.ceil(max * 10) / 10 + 0.5]
  }, [data, thresholds])

  const isRatioMode = thresholds?.neuromuscular_metric === 'high_band_ratio'
  const neuroUnit = thresholds?.neuromuscular_unit ?? (isRatioMode ? '%' : 'cm')

  const neuroDomain = useMemo(() => {
    const vals = data.map((r) => r.neuromuscular_value).filter((v) => v != null)
    if (isRatioMode) {
      const max = vals.length ? Math.max(...vals, thresholds?.high_band_ratio_baseline_pct ?? 30) : 40
      return [0, Math.min(100, Math.ceil(max * 1.15))]
    }
    const ceiling = thresholds?.jump_ceiling_30d_cm ?? 0
    const max = vals.length ? Math.max(...vals, ceiling) : ceiling || 70
    return [0, Math.ceil(max * 1.12)]
  }, [data, thresholds, isRatioMode])

  if (loading) {
    return (
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
        Loading triad risk profile…
      </p>
    )
  }

  if (!triadData || !data.length) {
    return (
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
        Select an athlete to view the injury-risk triad (ACWR, deep sleep, jump power).
      </p>
    )
  }

  const acwrHigh = thresholds?.acwr_high ?? 1.5
  const deepFloor = thresholds?.deep_sleep_min_hours ?? 1
  const jumpFloor = thresholds?.jump_floor_cm
  const jumpCeiling = thresholds?.jump_ceiling_30d_cm
  const jumpDropPct = thresholds?.jump_drop_pct ?? 10
  const ratioFloor = thresholds?.high_band_ratio_floor_pct
  const ratioBaseline = thresholds?.high_band_ratio_baseline_pct

  const neuroSubtitle = isRatioMode
    ? ratioFloor != null
      ? `high-band ratio · danger below ${ratioFloor}% (vs ~${ratioBaseline}% baseline)`
      : 'high-band jump ratio: insufficient BMP data'
    : jumpFloor != null && jumpCeiling != null
      ? `max jump · danger below ${jumpFloor} cm (${jumpDropPct}% under ${jumpCeiling} cm ceiling)`
      : 'max jump height: no BMP jump data in window'

  const handleChartHover = (state) => {
    if (state?.activeLabel) setHoverDate(state.activeLabel)
  }
  const handleChartLeave = () => setHoverDate(null)

  const showCriticalHover = hoverRow?.critical_risk
  const showCriticalSummary =
    !showCriticalHover && criticalDates?.length > 0

  const neuroRiskLabel = isRatioMode
    ? 'high-band jump ratio collapsed'
    : 'max jump below 30-day ceiling'

  return (
    <div>
      {showCriticalHover && (
        <div
          role="alert"
          style={{
            marginBottom: '14px',
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'rgba(220, 38, 38, 0.18)',
            border: '1px solid rgba(220, 38, 38, 0.55)',
            color: '#fecaca',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          Critical Risk: {hoverRow.calendar_date}: ACWR above {acwrHigh}, deep sleep
          below {deepFloor}h, and {neuroRiskLabel} on the same day.
        </div>
      )}
      {showCriticalSummary && (
        <div
          style={{
            marginBottom: '14px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.35)',
            color: '#fca5a5',
            fontSize: '12px',
          }}
        >
          Critical Risk days in window: {criticalDates.join(', ')}
        </div>
      )}

      <div
        style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px' }}
      >
        Hover any panel: crosshairs sync across all three. Catapult ACWR + jump metrics
        update daily for full roster; deep sleep requires WHOOP.
      </div>

      <div onMouseLeave={handleChartLeave}>
        <TriadPanel
          onMouseMove={handleChartHover}
          onMouseLeave={handleChartLeave}
          title="Workload shock"
          subtitle={`ACWR · danger above ${acwrHigh}`}
          data={data}
          dataKey="acwr"
          domain={acwrDomain}
          riskKey="acwr_risk"
          unit=""
          referenceArea={
            <ReferenceArea
              y1={acwrHigh}
              y2={acwrDomain[1]}
              fill={RED_FILL}
              stroke={RED_STROKE}
              strokeOpacity={0.4}
            />
          }
          referenceLine={
            <ReferenceLine
              y={acwrHigh}
              stroke="#dc2626"
              strokeDasharray="4 4"
              label={{
                value: acwrHigh,
                position: 'insideTopRight',
                fill: '#f87171',
                fontSize: 10,
              }}
            />
          }
        />

        <TriadPanel
          onMouseMove={handleChartHover}
          onMouseLeave={handleChartLeave}
          title="Tissue repair"
          subtitle={`deep sleep · danger below ${deepFloor}h (30d min)`}
          data={data}
          dataKey="deep_sleep_hours"
          domain={sleepDomain}
          riskKey="sleep_risk"
          unit="h"
          referenceArea={
            <ReferenceArea
              y1={0}
              y2={deepFloor}
              fill={RED_FILL}
              stroke={RED_STROKE}
              strokeOpacity={0.4}
            />
          }
        />

        <TriadPanel
          onMouseMove={handleChartHover}
          onMouseLeave={handleChartLeave}
          title="Neuromuscular power"
          subtitle={neuroSubtitle}
          data={data}
          dataKey="neuromuscular_value"
          domain={neuroDomain}
          riskKey="neuromuscular_risk"
          unit={neuroUnit}
          showXAxis
          chartHeight={140}
          referenceArea={
            isRatioMode && ratioFloor != null ? (
              <ReferenceArea
                y1={0}
                y2={ratioFloor}
                fill={RED_FILL}
                stroke={RED_STROKE}
                strokeOpacity={0.4}
              />
            ) : jumpFloor != null ? (
              <ReferenceArea
                y1={0}
                y2={jumpFloor}
                fill={RED_FILL}
                stroke={RED_STROKE}
                strokeOpacity={0.4}
              />
            ) : null
          }
          referenceLine={
            isRatioMode && ratioFloor != null ? (
              <ReferenceLine
                y={ratioFloor}
                stroke="#dc2626"
                strokeDasharray="4 4"
                label={{
                  value: `${ratioFloor}%`,
                  position: 'insideTopRight',
                  fill: '#f87171',
                  fontSize: 10,
                }}
              />
            ) : jumpFloor != null ? (
              <ReferenceLine
                y={jumpFloor}
                stroke="#dc2626"
                strokeDasharray="4 4"
                label={{
                  value: `−${jumpDropPct}%`,
                  position: 'insideTopRight',
                  fill: '#f87171',
                  fontSize: 10,
                }}
              />
            ) : null
          }
        />
      </div>
    </div>
  )
}

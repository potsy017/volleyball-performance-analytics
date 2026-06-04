import KPICard from './KPICard'
import {
  TOTAL_JUMP_LABEL,
  HIGH_JUMP_LABEL,
  HIGH_JUMP_PCT_LABEL,
  TOTAL_JUMP_SUB,
  HIGH_JUMP_SUB,
  HIGH_JUMP_PCT_SUB,
  highJumpPct,
} from '../../utils/jumpMetrics'

/**
 * Three KPI cards: total jumps, high jumps (≥40 cm BMP), and high %.
 */
export default function JumpKpiCards({
  total,
  high,
  periodSub,
  totalColor = '#81C784',
  highColor = '#F5C400',
  pctColor = '#FFB74D',
}) {
  const pct = highJumpPct(high, total)
  const pctSub =
    total != null && high != null && total > 0
      ? `${high} of ${total} · ${periodSub}`
      : periodSub

  return (
    <>
      <KPICard
        label={TOTAL_JUMP_LABEL}
        value={total}
        decimals={0}
        sub={TOTAL_JUMP_SUB}
        color={totalColor}
      />
      <KPICard
        label={HIGH_JUMP_LABEL}
        value={high}
        decimals={0}
        sub={HIGH_JUMP_SUB}
        color={highColor}
      />
      <KPICard
        label={HIGH_JUMP_PCT_LABEL}
        value={pct}
        unit={pct != null ? '%' : ''}
        decimals={1}
        sub={pct != null ? HIGH_JUMP_PCT_SUB : periodSub}
        color={pctColor}
      />
    </>
  )
}

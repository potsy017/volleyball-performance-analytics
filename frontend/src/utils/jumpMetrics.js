/** Catapult BMP jump labels (see toolkit catapult_bmp_jumps_handover.md). */

export const TOTAL_JUMP_LABEL = 'Total Jumps (BMP)'
export const HIGH_JUMP_LABEL = 'High Jumps (≥40 cm)'
export const HIGH_JUMP_PCT_LABEL = 'High Jump %'

export const TOTAL_JUMP_SUB = 'All BMP jumps with detected flight'
export const HIGH_JUMP_SUB = 'Subset ≥40 cm (~0.57 s flight time)'
export const HIGH_JUMP_PCT_SUB = 'High jumps ÷ total jumps (same day)'

export const CHART_TOTAL_JUMPS_TITLE = 'Daily total jumps — all BMP detected jumps'
export const CHART_HIGH_JUMPS_TITLE = 'Daily high jumps — BMP ≥40 cm bar only'

/** @returns {number|null} percent 0–100 */
export function highJumpPct(high, total) {
  if (high == null || total == null) return null
  const t = Number(total)
  const h = Number(high)
  if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(h)) return null
  return Math.round((h / t) * 1000) / 10
}

export function formatHighJumpPct(high, total) {
  const p = highJumpPct(high, total)
  return p == null ? '—' : `${p}%`
}

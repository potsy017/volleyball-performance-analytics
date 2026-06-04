/**
 * Normalise athlete radar inputs to 0–100 for Recharts.
 * Always returns a fixed 5- or 7-axis web; spokes without data plot at centre (0).
 */

function clampScore(value) {
  if (value == null || Number.isNaN(value)) return null
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10))
}

function ratioPct(current, baseline) {
  const c = Number(current)
  const b = Number(baseline)
  if (!Number.isFinite(c) || !Number.isFinite(b) || b <= 0) return null
  return clampScore((c / b) * 100)
}

function acwrSafetyScore(acwr) {
  const a = Number(acwr)
  if (!Number.isFinite(a)) return null
  if (a >= 0.8 && a <= 1.3) {
    return clampScore(100 - Math.abs(1.0 - a) * 60)
  }
  if (a > 1.5 || a < 0.5) return clampScore(22)
  if (a > 1.3 || a < 0.8) return clampScore(52)
  return clampScore(38)
}

function axisEntry(subject, score, extra = {}) {
  const hasData = score !== null && score !== undefined
  return {
    subject,
    value: hasData ? score : 0,
    fullMark: 100,
    hasData,
    ...extra,
  }
}

/**
 * @param {object} playerData
 * @returns {{ axes: object[], axisCount: 5|7, hasWhoop: boolean }}
 */
export function formatRadarData(playerData) {
  if (!playerData) {
    return { axes: [], axisCount: 5, hasWhoop: false }
  }

  const cur = playerData.current || playerData
  const base = playerData.baseline_30d || playerData.baseline || {}

  const hasWhoop =
    playerData.has_whoop === true ||
    cur.whoop_recovery != null ||
    cur.whoop_sleep_efficiency != null ||
    playerData.whoop_recovery != null

  const acwrRaw = cur.acwr
  const acwrScore =
    acwrRaw != null && acwrRaw !== '' ? acwrSafetyScore(acwrRaw) : null

  const hardwareAxes = [
    axisEntry(
      'Explosive Power',
      ratioPct(cur.peak_velocity, base.avg_peak_velocity),
    ),
    axisEntry('Volume', ratioPct(cur.total_jumps, base.max_total_jumps)),
    axisEntry('Intensity', ratioPct(cur.high_jumps, base.max_high_jumps)),
    axisEntry('Fitness/Engine', ratioPct(cur.load_per_min, base.avg_load_per_min)),
    axisEntry('ACWR Safety', acwrScore, { acwrRaw: acwrRaw ?? null }),
  ]

  const whoopAxes = hasWhoop
    ? [
        axisEntry(
          'Recovery',
          clampScore(cur.whoop_recovery ?? playerData.whoop_recovery),
        ),
        axisEntry(
          'Sleep Eff',
          clampScore(
            cur.whoop_sleep_efficiency ?? playerData.whoop_sleep_efficiency,
          ),
        ),
      ]
    : []

  return {
    axes: [...hardwareAxes, ...whoopAxes],
    axisCount: hasWhoop ? 7 : 5,
    hasWhoop,
  }
}

export default formatRadarData

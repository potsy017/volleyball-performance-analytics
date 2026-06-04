import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import StatusBadge, { acwrBadge, recoveryBadge } from '../components/ui/StatusBadge'
import { athleteApi, catapultApi, dashboardApi, gymawareApi, whoopApi } from '../services/api'
import { useDashboard } from '../context/DashboardContext'

function isoDateShift(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function dayDiffFromToday(isoDate) {
  if (!isoDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return Math.round((today.getTime() - d.getTime()) / 86400000)
}

function freshnessLabel(isoDate) {
  const dd = dayDiffFromToday(isoDate)
  if (dd == null) return null
  if (dd === 0) return 'Today'
  if (dd === 1) return 'Yesterday'
  return `Latest (${dd}d ago)`
}

function latestByDate(rows, dateGetter, maxDays = null) {
  const dated = (rows || [])
    .map(r => ({ row: r, date: dateGetter(r) }))
    .filter(x => !!x.date)
    .map(x => ({ ...x, age: dayDiffFromToday(x.date) }))
    .filter(x => x.age != null && x.age >= 0)
    .sort((a, b) => a.age - b.age)
  if (!dated.length) return null
  if (maxDays != null && dated[0].age > maxDays) return null
  return dated[0]
}

function buildReadiness(acwr, recovery) {
  if (recovery != null && acwr != null) {
    const recPart = Math.max(0, Math.min(100, Number(recovery)))
    const acwrPenalty = acwr > 1.5 ? 35 : acwr > 1.3 ? 18 : acwr < 0.8 ? 12 : 0
    return Math.max(0, Math.min(100, Math.round(recPart - acwrPenalty)))
  }
  if (recovery != null) return Math.round(Number(recovery))
  if (acwr != null) {
    if (acwr > 1.5) return 35
    if (acwr > 1.3) return 55
    if (acwr >= 0.8) return 78
    return 62
  }
  return null
}

function readinessStatus(acwr, recovery) {
  if (acwr == null && recovery == null) {
    return {
      label: 'Insufficient Data',
      tone: 'neutral',
      title: 'No ACWR or recovery score available',
    }
  }

  // With Whoop data: ACWR + recovery gates.
  if (recovery != null) {
    if (acwr > 1.5 || recovery < 33) return { label: 'Red', tone: 'red' }
    if ((acwr >= 1.3 && acwr <= 1.5) || (recovery >= 34 && recovery <= 66)) {
      return { label: 'Yellow', tone: 'amber' }
    }
    if (acwr >= 0.8 && acwr < 1.3 && recovery > 67) return { label: 'Green', tone: 'green' }
    return { label: 'Yellow', tone: 'amber' }
  }

  // Fallback: ACWR only.
  if (acwr > 1.5) return { label: 'Red', tone: 'red' }
  if (acwr >= 1.3 && acwr <= 1.5) return { label: 'Yellow', tone: 'amber' }
  if (acwr >= 0.8 && acwr < 1.3) return { label: 'Green', tone: 'green' }
  return { label: 'Insufficient Data', tone: 'neutral' }
}

function recent7Blocks(dateSet) {
  const out = []
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    out.push({
      key,
      label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2),
      active: dateSet.has(key),
    })
  }
  return out
}

function ExpandedAthleteRow({ athleteKey, selectedDay, onSelectDay, onOpenSource }) {
  const from7 = isoDateShift(-6)

  const { data: cat7 = [] } = useQuery({
    queryKey: ['readiness-cat7', athleteKey],
    queryFn: () => catapultApi.sessions({ athlete_key: athleteKey, days: 7 }),
    enabled: !!athleteKey,
  })
  const { data: gym7 = [] } = useQuery({
    queryKey: ['readiness-gym7', athleteKey],
    queryFn: () => gymawareApi.sessions({ athlete_key: athleteKey, days: 7 }),
    enabled: !!athleteKey,
  })
  const { data: whoopRec7 = [] } = useQuery({
    queryKey: ['readiness-rec7', athleteKey],
    queryFn: () => whoopApi.recovery({ athlete_key: athleteKey, days: 7 }),
    enabled: !!athleteKey,
  })
  const { data: whoopWork7 = [] } = useQuery({
    queryKey: ['readiness-work7', athleteKey],
    queryFn: () => whoopApi.workout({ athlete_key: athleteKey, days: 7 }),
    enabled: !!athleteKey,
  })

  const catFresh = latestByDate(cat7, r => r.calendar_date || r.session_date)
  const gymFresh = latestByDate(gym7, r => r.calendar_date || r.session_date)
  const recFresh = latestByDate(whoopRec7, r => r.calendar_date || r.session_date)
  const wkFresh = latestByDate(whoopWork7, r => r.calendar_date || r.session_date)

  const catTargetDate = selectedDay || catFresh?.date || null
  const gymTargetDate = selectedDay || gymFresh?.date || null
  const recTargetDate = selectedDay || recFresh?.date || null
  const wkTargetDate = selectedDay || wkFresh?.date || null

  const catRecentRows = catTargetDate
    ? cat7.filter(r => (r.calendar_date || r.session_date) === catTargetDate)
    : []
  const gymRecentRows = gymTargetDate
    ? gym7.filter(r => (r.calendar_date || r.session_date) === gymTargetDate)
    : []
  const recRow = recTargetDate
    ? whoopRec7.find(r => (r.calendar_date || r.session_date) === recTargetDate)
    : null
  const wkRow = wkTargetDate
    ? whoopWork7.find(r => (r.calendar_date || r.session_date) === wkTargetDate)
    : null

  const catDates = new Set(
    cat7
      .map(r => r.calendar_date || r.session_date)
      .filter(d => d && d >= from7)
  )
  const gymDates = new Set(
    gym7
      .map(r => r.calendar_date || r.session_date)
      .filter(d => d && d >= from7)
  )
  const mergedDates = new Set([...catDates, ...gymDates])
  const weekBlocks = recent7Blocks(mergedDates)

  const catLoadRecent = catRecentRows.reduce((s, r) => s + (Number(r.total_player_load) || 0), 0)
  const catJumpsByDay = {}
  catRecentRows.forEach((r) => {
    const d = r.calendar_date || r.session_date
    const t = Number(r.total_jumps) || 0
    if (d && t) catJumpsByDay[d] = Math.max(catJumpsByDay[d] ?? 0, t)
  })
  const catJumpsRecent = Object.values(catJumpsByDay).reduce((s, v) => s + v, 0)
  const catMaxVelRecent = catRecentRows.reduce((m, r) => Math.max(m, Number(r.max_vel) || 0), 0)

  const gymRepsRecent = gymRecentRows.reduce((s, r) => s + (Number(r.rep_count) || 0), 0)
  const gymAvgVelRecent = gymRecentRows.length
    ? gymRecentRows.reduce((s, r) => s + (Number(r.mean_velocity) || 0), 0) / gymRecentRows.length
    : null
  const gymPeakPowerRecent = gymRecentRows.reduce((m, r) => Math.max(m, Number(r.peak_velocity) || 0), 0)

  return (
    <div style={{ padding: '14px 12px 8px', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '12px' }}>
        <div className="card" style={{ padding: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
            GymAware ({gymTargetDate ? freshnessLabel(gymTargetDate) : 'Awaiting Sync'})
          </div>
          <div style={{ marginBottom: '8px' }}>
            <button
              type="button"
              className="toggle-btn"
              onClick={() => onOpenSource?.('gymaware', athleteKey, gymTargetDate)}
            >
              Open GymAware →
            </button>
          </div>
          <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            <div>Session Type: {gymRecentRows[0]?.exercise_name || 'Awaiting Sync'}</div>
            <div>Total Reps: {gymRepsRecent || '—'}</div>
            <div>Core Lift: {gymRecentRows[0]?.exercise_name || '—'}</div>
            <div>Avg Velocity: {gymAvgVelRecent != null ? `${gymAvgVelRecent.toFixed(2)} m/s` : '—'}</div>
            <div>Peak Power: {gymPeakPowerRecent ? `${gymPeakPowerRecent.toFixed(2)} (proxy: peak vel)` : '—'}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
            Catapult ({catTargetDate ? freshnessLabel(catTargetDate) : 'Awaiting Sync'})
          </div>
          <div style={{ marginBottom: '8px' }}>
            <button
              type="button"
              className="toggle-btn"
              onClick={() => onOpenSource?.('catapult', athleteKey, catTargetDate)}
            >
              Open Catapult →
            </button>
          </div>
          <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            <div>Session Type: {catRecentRows[0]?.activity_name || 'Awaiting Sync'}</div>
            <div>Total Jumps: {catJumpsRecent ? Math.round(catJumpsRecent) : '—'}</div>
            <div>Player Load: {catLoadRecent ? Math.round(catLoadRecent) : '—'}</div>
            <div>Max Velocity: {catMaxVelRecent ? `${catMaxVelRecent.toFixed(2)} m/s` : '—'}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>7-day history map</div>
        <div style={{ marginBottom: '8px' }}>
          <button
            type="button"
            className="toggle-btn"
            onClick={() => onOpenSource?.('whoop', athleteKey, recTargetDate)}
          >
            Open WHOOP →
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px' }}>
          {weekBlocks.map(b => {
            const isSelected = selectedDay === b.key
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => onSelectDay(isSelected ? null : b.key)}
                title={`${b.key}: ${b.active ? 'Session logged' : 'No session'}${isSelected ? ' (selected)' : ''}`}
                style={{
                  borderRadius: '8px',
                  padding: '8px 4px',
                  textAlign: 'center',
                  fontSize: '11px',
                  cursor: 'pointer',
                  border: `1px solid ${
                    isSelected
                      ? 'rgba(100,181,246,0.8)'
                      : b.active
                        ? 'rgba(200,230,0,0.5)'
                        : 'var(--border)'
                  }`,
                  background: isSelected
                    ? 'rgba(33,150,243,0.18)'
                    : b.active
                      ? 'rgba(200,230,0,0.15)'
                      : 'rgba(255,255,255,0.02)',
                  color: isSelected ? '#90CAF9' : (b.active ? '#C8E600' : 'var(--text-muted)'),
                }}
              >
                <div style={{ fontWeight: 600 }}>{b.label}</div>
                <div style={{ marginTop: 2 }}>{b.key.slice(5)}</div>
              </button>
            )
          })}
        </div>
        <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
          Whoop {recTargetDate ? freshnessLabel(recTargetDate)?.toLowerCase() : 'latest'}: {recRow ? `${Math.round(recRow.recovery_score ?? 0)}% recovery` : 'No Device / Awaiting Sync'}
          {' · '}
          Sleep: {recRow?.sleep_performance_percentage != null ? `${Math.round(recRow.sleep_performance_percentage)}%` : '—'}
          {' · '}
          Calories: {wkRow?.calories_kcal != null ? Math.round(wkRow.calories_kcal) : '—'}
        </div>
      </div>
    </div>
  )
}

export default function Readiness() {
  const navigate = useNavigate()
  const { setSelectedAthlete } = useDashboard()
  const [searchParams, setSearchParams] = useSearchParams()
  const [expanded, setExpanded] = useState(searchParams.get('athlete') || null)
  const from7 = isoDateShift(-6)
  const selectedDay = searchParams.get('day')

  const setRouteParams = (nextAthlete, nextDay) => {
    const next = new URLSearchParams(searchParams)
    if (nextAthlete) next.set('athlete', nextAthlete)
    else next.delete('athlete')
    if (nextDay) next.set('day', nextDay)
    else next.delete('day')
    setSearchParams(next, { replace: true })
  }

  const openSourcePage = (source, athleteKey, day) => {
    if (athleteKey) setSelectedAthlete(athleteKey)
    const next = new URLSearchParams()
    if (day) next.set('day', day)
    navigate(`/${source}${next.toString() ? `?${next.toString()}` : ''}`)
  }

  const { data: snapshot = [], isLoading } = useQuery({
    queryKey: ['readiness-snapshot'],
    queryFn: dashboardApi.teamSnapshot,
  })
  const { data: athletes = [] } = useQuery({
    queryKey: ['athletes'],
    queryFn: athleteApi.list,
  })

  // Lightweight per-athlete 7d counts; table stays usable while these resolve.
  const { data: cat7 = [] } = useQuery({
    queryKey: ['readiness-cat7-team'],
    queryFn: () => catapultApi.sessions({ days: 7 }),
  })
  const { data: gym7 = [] } = useQuery({
    queryKey: ['readiness-gym7-team'],
    queryFn: () => gymawareApi.sessions({ days: 7 }),
  })
  const { data: rec7 = [] } = useQuery({
    queryKey: ['readiness-rec7-team'],
    queryFn: () => whoopApi.recovery({ days: 7 }),
  })
  const { data: wk7 = [] } = useQuery({
    queryKey: ['readiness-work7-team'],
    queryFn: () => whoopApi.workout({ days: 7 }),
  })

  const rows = useMemo(() => {
    const byKey = new Map()
    for (const a of athletes || []) {
      byKey.set(a.athlete_internal_key, {
        athlete_internal_key: a.athlete_internal_key,
        athlete_name: a.athlete_display_name,
      })
    }
    for (const s of snapshot || []) {
      byKey.set(s.athlete_internal_key, {
        ...byKey.get(s.athlete_internal_key),
        ...s,
      })
    }

    const get7DateUnionCount = athleteKey => {
      const catDates = new Set(
        cat7
          .filter(r => r.athlete_internal_key === athleteKey)
          .map(r => r.calendar_date || r.session_date)
          .filter(d => d && d >= from7)
      )
      const gymDates = new Set(
        gym7
          .filter(r => r.athlete_internal_key === athleteKey)
          .map(r => r.calendar_date || r.session_date)
          .filter(d => d && d >= from7)
      )
      return new Set([...catDates, ...gymDates]).size
    }

    return [...byKey.values()]
      .map(a => {
        const catAthRows = cat7.filter(r => r.athlete_internal_key === a.athlete_internal_key)
        const gymAthRows = gym7.filter(r => r.athlete_internal_key === a.athlete_internal_key)
        const recAthRows = rec7.filter(r => r.athlete_internal_key === a.athlete_internal_key)
        const wkAthRows = wk7.filter(r => r.athlete_internal_key === a.athlete_internal_key)

        const catFresh = latestByDate(catAthRows, r => r.calendar_date || r.session_date)
        const gymFresh = latestByDate(gymAthRows, r => r.calendar_date || r.session_date)
        const recFresh = latestByDate(recAthRows, r => r.calendar_date || r.session_date)
        const wkFresh = latestByDate(wkAthRows, r => r.calendar_date || r.session_date)

        const catFreshRows = catFresh
          ? catAthRows.filter(r => (r.calendar_date || r.session_date) === catFresh.date)
          : []
        const gymFreshRows = gymFresh
          ? gymAthRows.filter(r => (r.calendar_date || r.session_date) === gymFresh.date)
          : []

        const jumpsRecent = catFreshRows.length
          ? Math.max(...catFreshRows.map((r) => Number(r.total_jumps) || 0))
          : 0
        const loadRecent = catFreshRows.reduce((s, r) => s + (Number(r.total_player_load) || 0), 0)

        const rag = readinessStatus(a.acwr, a.recovery)
        const readiness = buildReadiness(a.acwr, a.recovery)
        const hasWhoop = recAthRows.length > 0

        return {
          ...a,
          rag,
          readiness,
          session_count_7d: get7DateUnionCount(a.athlete_internal_key),
          jumps_recent: jumpsRecent || null,
          load_recent: loadRecent || null,
          cat_fresh_label: catFresh ? freshnessLabel(catFresh.date) : null,
          gym_fresh_label: gymFresh ? freshnessLabel(gymFresh.date) : null,
          whoop_fresh_label: recFresh ? freshnessLabel(recFresh.date) : null,
          whoop_recovery_recent: recFresh?.row?.recovery_score ?? null,
          whoop_sleep_recent: recFresh?.row?.sleep_performance_percentage ?? null,
          whoop_calories_recent: wkFresh?.row?.calories_kcal ?? null,
          gymaware_core_metric_recent: gymFreshRows.length
            ? Math.max(...gymFreshRows.map(r => Number(r.peak_velocity) || 0))
            : null,
          has_whoop_device: hasWhoop,
        }
      })
      .sort((a, b) => (a.athlete_name || '').localeCompare(b.athlete_name || ''))
  }, [athletes, snapshot, cat7, gym7, rec7, wk7, from7])

  return (
    <div className="page-enter" style={{ padding: '24px', maxWidth: '1500px', margin: '0 auto' }}>
      <PageHeader
        title="Readiness"
        subtitle="Master athlete workload + recovery board with on-demand session detail"
      />

      <div className="card">
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
          Click a player row to expand athlete detail. Values prefer yesterday and fall back to the latest sync within 3 days.
        </div>
        {isLoading ? (
          <LoadingSpinner message="Loading readiness board..." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="vpa-table">
              <thead>
                <tr>
                  <th>Player Name</th>
                  <th>Status</th>
                  <th>Readiness</th>
                  <th>ACWR</th>
                  <th>7D Sessions</th>
                  <th>Total Jumps & Load (Yesterday)</th>
                  <th>Whoop (Recovery / Sleep / Calories)</th>
                  <th>GymAware Core (Yesterday)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const isOpen = expanded === r.athlete_internal_key
                  const recovery = recoveryBadge(r.whoop_recovery_recent)
                  const acwr = acwrBadge(r.acwr_status, r.acwr)
                  const whoopText = r.has_whoop_device
                    ? (
                      r.whoop_recovery_recent != null
                        ? `${Math.round(r.whoop_recovery_recent)}% / ${r.whoop_sleep_recent != null ? `${Math.round(r.whoop_sleep_recent)}%` : '—'} / ${r.whoop_calories_recent != null ? Math.round(r.whoop_calories_recent) : '—'}`
                        : 'Awaiting Sync'
                    )
                    : 'No Device'
                  return (
                    <Fragment key={r.athlete_internal_key}>
                      <tr
                        onClick={() => {
                          const nextAthlete = isOpen ? null : r.athlete_internal_key
                          setExpanded(nextAthlete)
                          setRouteParams(nextAthlete, null)
                        }}
                        style={{ cursor: 'pointer' }}
                        title="Click to expand athlete detail"
                      >
                        <td style={{ fontWeight: 600 }}>{r.athlete_name || '—'}</td>
                        <td><StatusBadge label={r.rag.label} tone={r.rag.tone} title={r.rag.title} /></td>
                        <td>{r.readiness != null ? `${r.readiness}` : <StatusBadge label="Insufficient Data" tone="neutral" />}</td>
                        <td>
                          <StatusBadge label={acwr.label} tone={acwr.tone} title={acwr.title} />
                          {r.acute_load != null && (
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 6 }}>
                              ({r.acute_load}/{r.chronic_load})
                            </span>
                          )}
                        </td>
                        <td>{r.session_count_7d || '—'}</td>
                        <td>
                          {r.load_recent != null || r.jumps_recent != null
                            ? (
                              <span>
                                Jumps {Math.round(r.jumps_recent || 0)} · Load {Math.round(r.load_recent || 0)}
                                <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontSize: 11 }}>
                                  {r.cat_fresh_label || r.gym_fresh_label || 'Recent'}
                                </span>
                              </span>
                            )
                            : <StatusBadge label="Awaiting Sync" tone="neutral" />}
                        </td>
                        <td>
                          {r.has_whoop_device
                            ? (r.whoop_recovery_recent != null
                              ? (
                                <span>
                                  {whoopText}
                                  <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontSize: 11 }}>
                                    {r.whoop_fresh_label || 'Recent'}
                                  </span>
                                  {' '}
                                  <StatusBadge label={recovery.label} tone={recovery.tone} />
                                </span>
                              )
                              : <StatusBadge label="Awaiting Sync" tone="neutral" />)
                            : <StatusBadge label="No Device" tone="neutral" />}
                        </td>
                        <td>
                          {r.gymaware_core_metric_recent != null
                            ? (
                              <span>
                                {r.gymaware_core_metric_recent.toFixed(2)} m/s
                                <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontSize: 11 }}>
                                  {r.gym_fresh_label || 'Recent'}
                                </span>
                              </span>
                            )
                            : <StatusBadge label="Awaiting Sync" tone="neutral" />}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={8} style={{ padding: 0 }}>
                            <ExpandedAthleteRow
                              athleteKey={r.athlete_internal_key}
                              selectedDay={selectedDay}
                              onSelectDay={(day) => setRouteParams(r.athlete_internal_key, day)}
                              onOpenSource={openSourcePage}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { gymawareApi } from '../services/api'
import { useDashboard } from '../context/DashboardContext'
import KPICard from '../components/ui/KPICard'
import PageHeader from '../components/ui/PageHeader'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import SelectDropdown from '../components/ui/SelectDropdown'
import DateRangePicker from '../components/ui/DateRangePicker'
import LastSync from '../components/ui/LastSync'
import TrendLineChart from '../components/charts/TrendLineChart'
import VLScatterChart from '../components/charts/VLScatterChart'
import LoadVelocityMultiProfileChart from '../components/charts/LoadVelocityMultiProfileChart'
import LoadVelocityProgressChart from '../components/charts/LoadVelocityProgressChart'
import { downloadCsv } from '../utils/csvExport'

function PctBadge({ value }) {
  if (value == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const cls = value >= 90 ? 'badge-green' : value >= 75 ? 'badge-amber' : 'badge-red'
  return <span className={`badge ${cls}`}>{value.toFixed(1)}%</span>
}

export default function Gymaware() {
  const { selectedAthlete } = useDashboard()
  const [searchParams, setSearchParams] = useSearchParams()
  const focusedDay = searchParams.get('day')
  const [exercise, setExercise] = useState('')
  const [days, setDays] = useState(30)
  const [lvView, setLvView] = useState('profile') // profile | progress
  const [lvSessionLimit, setLvSessionLimit] = useState('recent4')
  const [lvExtrapolate, setLvExtrapolate] = useState(true)
  const [lvShowPb, setLvShowPb] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (days > 90) {
      setLvExtrapolate(false)
      setLvSessionLimit('recent4')
    } else if (days > 30) {
      setLvSessionLimit('recent4')
      setLvExtrapolate(true)
    }
  }, [days])

  const athleteParam = selectedAthlete ? { athlete_key: selectedAthlete } : {}

  const { data: exercises = [] } = useQuery({
    queryKey: ['gym-exercises', athleteParam],
    queryFn: () => gymawareApi.exercises(athleteParam),
  })

  const svpParams = { ...athleteParam, days, ...(exercise ? { exercise } : {}) }

  const { data: sessionData = [], isLoading: sessLoading } = useQuery({
    queryKey: ['session-vs-pb', svpParams],
    queryFn: () => gymawareApi.sessionVsPb(svpParams),
  })

  const { data: pbData = [], isLoading: pbLoading } = useQuery({
    queryKey: ['gym-pb', { ...athleteParam, exercise }],
    queryFn: () => gymawareApi.pb({ ...athleteParam, ...(exercise ? { exercise } : {}) }),
  })

  const { data: trendData = [] } = useQuery({
    queryKey: ['velocity-trend', selectedAthlete, exercise],
    queryFn: () => gymawareApi.velocityTrend({ athlete_key: selectedAthlete, exercise, days: 90 }),
    enabled: !!selectedAthlete && !!exercise,
  })

  const { data: vlProfile = [], isLoading: vlLoading } = useQuery({
    queryKey: ['vl-profile', selectedAthlete, exercise],
    queryFn: () => gymawareApi.vlProfile({ athlete_key: selectedAthlete, exercise, days: 90 }),
    enabled: !!selectedAthlete && !!exercise,
  })

  const { data: loadVelocityAnalysis, isLoading: lvAnalysisLoading } = useQuery({
    queryKey: ['load-velocity-analysis', selectedAthlete, exercise, days],
    queryFn: () =>
      gymawareApi.loadVelocityAnalysis({
        athlete_key: selectedAthlete,
        exercise,
        days,
      }),
    enabled: !!selectedAthlete && !!exercise,
  })

  // Latest session for scatter + derived KPIs
  const latestVL   = vlProfile[vlProfile.length - 1] ?? null
  const prevVL     = vlProfile[vlProfile.length - 2] ?? null
  const v0Delta    = latestVL && prevVL ? +(latestVL.v0 - prevVL.v0).toFixed(3) : null
  const l0Delta    = latestVL && prevVL ? +(latestVL.l0 - prevVL.l0).toFixed(1) : null

  const latestDate = sessionData[0]?.session_date || sessionData[0]?.calendar_date
  const latestSets = sessionData.filter(r => (r.session_date || r.calendar_date) === latestDate)
  const avgPctPeak = latestSets.length
    ? latestSets.reduce((s, r) => s + (r.pct_of_pb_peak ?? 0), 0) / latestSets.length
    : null

  const sessionProfiles = loadVelocityAnalysis?.session_profiles ?? []
  const pbBenchmark = loadVelocityAnalysis?.pb_benchmark

  const focusedSessionData = useMemo(
    () => (focusedDay ? sessionData.filter(r => (r.session_date || r.calendar_date) === focusedDay) : sessionData),
    [sessionData, focusedDay]
  )

  useEffect(() => {
    if (!focusedDay) return
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const d = new Date(`${focusedDay}T00:00:00`)
    if (Number.isNaN(d.getTime())) return
    const needed = Math.max(1, Math.ceil((today.getTime() - d.getTime()) / 86400000) + 1)
    if (needed > days) setDays(Math.min(365, needed))
  }, [focusedDay, days])

  const lvMaxSessions = useMemo(() => {
    if (lvSessionLimit === 'all') return null
    if (lvSessionLimit === 'recent3') return 3
    if (lvSessionLimit === 'recent4') return 4
    if (lvSessionLimit === 'recent6') return 6
    return 4
  }, [lvSessionLimit])

  return (
    <div className="page-enter" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader title="Gymaware" subtitle="Session summary, personal bests & velocity trends">
        <LastSync data={sessionData} />
        {selectedAthlete && (
          <button className="toggle-btn" onClick={() => navigate('/report')}
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            🖨 Report
          </button>
        )}
        <SelectDropdown
          options={exercises}
          value={exercise}
          onChange={setExercise}
          placeholder="All exercises"
          minWidth={200}
        />
        <DateRangePicker days={days} onChange={setDays} />
      </PageHeader>

      {focusedDay && (
        <div className="card" style={{ marginBottom: '12px', padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Focused day: <strong style={{ color: 'var(--text-primary)' }}>{focusedDay}</strong>. Session table is filtered to this date.
            </div>
            <button
              type="button"
              className="toggle-btn"
              onClick={() => {
                const next = new URLSearchParams(searchParams)
                next.delete('day')
                setSearchParams(next, { replace: true })
              }}
            >
              Clear day focus
            </button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <KPICard label="Sets in range" value={sessionData.length} decimals={0} sub={`last ${days} days`} />
        <KPICard label="Avg % of PB (peak)" value={avgPctPeak} unit="%" decimals={1}
          color={avgPctPeak >= 90 ? '#4CAF50' : avgPctPeak >= 75 ? '#F5C400' : '#F44336'}
          sub="latest session" />
        <KPICard label="Exercises logged" value={exercises.length} decimals={0} color="var(--text-secondary)" />
        <KPICard label="PB records" value={pbData.length} decimals={0} color="var(--text-secondary)" />
      </div>

      {/* Velocity trend (when exercise selected) */}
      {selectedAthlete && exercise && trendData.length > 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>
            Velocity trend — {exercise}
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '8px' }}>today vs PB</span>
          </div>
          <TrendLineChart
            data={trendData}
            lines={[
              { key: 'todays_peak_velocity', name: "Today's Peak Vel", color: '#C8E600' },
              { key: 'pb_peak_velocity',     name: 'PB Peak Vel',     color: '#4CAF50', dashed: true },
            ]}
            height={220}
          />
        </div>
      )}

      {/* Load–velocity: one line per session */}
      {selectedAthlete && exercise && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
            Load–velocity profile — {exercise}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '14px' }}>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-btn ${lvView === 'profile' ? 'active' : ''}`}
                onClick={() => setLvView('profile')}
              >
                Load–velocity
              </button>
              <button
                type="button"
                className={`toggle-btn ${lvView === 'progress' ? 'active' : ''}`}
                onClick={() => setLvView('progress')}
              >
                Progress over time
              </button>
            </div>
            {lvView === 'profile' && (
              <>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Sessions shown:</span>
                <div className="toggle-group">
                  {[
                    { id: 'recent3', label: 'Last 3' },
                    { id: 'recent4', label: 'Last 4' },
                    { id: 'recent6', label: 'Last 6' },
                    { id: 'all', label: 'All' },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      className={`toggle-btn ${lvSessionLimit === id ? 'active' : ''}`}
                      onClick={() => setLvSessionLimit(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={`toggle-btn ${lvExtrapolate ? 'active' : ''}`}
                  onClick={() => setLvExtrapolate(v => !v)}
                  title="Off = connect only loads actually lifted that day (clearer for long ranges)"
                >
                  Extrapolate 25–105 kg
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${lvShowPb ? 'active' : ''}`}
                  onClick={() => setLvShowPb(v => !v)}
                >
                  PB benchmark
                </button>
              </>
            )}
          </div>

          {sessionProfiles.length > 0 && (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {sessionProfiles.length} training date{sessionProfiles.length !== 1 ? 's' : ''} in the last {days} days.
              {days > 90 && lvView === 'profile' && (
                <> For 3–6 month ranges, use <strong>Progress over time</strong> or limit to last 3–4 sessions.</>
              )}
            </p>
          )}

          {lvAnalysisLoading ? (
            <LoadingSpinner message="Building load–velocity profiles…" />
          ) : lvView === 'progress' ? (
            <LoadVelocityProgressChart
              sessionProfiles={sessionProfiles}
              pbBenchmark={pbBenchmark}
              height={300}
            />
          ) : (
            <LoadVelocityMultiProfileChart
              sessionProfiles={sessionProfiles}
              pbBenchmark={pbBenchmark}
              maxSessions={lvMaxSessions}
              extrapolate={lvExtrapolate}
              showPb={lvShowPb}
              connectObservedOnly={!lvExtrapolate}
              height={440}
            />
          )}
        </div>
      )}

      {/* ── V-L PROFILE SECTION (requires athlete + exercise) ── */}
      {selectedAthlete && exercise && (
        <>
          {vlLoading ? (
            <div className="card" style={{ marginBottom: '20px' }}><LoadingSpinner message="Computing V-L profile…" /></div>
          ) : vlProfile.length >= 2 ? (
            <>
              {/* KPI row: V0 and L0 from latest session */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', marginBottom: '16px',
                background: 'rgba(200,230,0,0.06)', border: '1px solid rgba(200,230,0,0.15)',
                borderRadius: '10px', fontSize: '12px', color: '#C8E600',
              }}>
                <span>📐</span>
                <strong>Load-Velocity Profile</strong>
                <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>
                  — linear regression across sets · V0 = theoretical max velocity (unloaded) · L0 = theoretical max load (zero velocity)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <KPICard
                  label="V0 (Vmax)"
                  value={latestVL?.v0}
                  unit="m/s"
                  decimals={3}
                  color="#C8E600"
                  sub={v0Delta != null ? `${v0Delta >= 0 ? '+' : ''}${v0Delta} vs prev` : 'last session'}
                />
                <KPICard
                  label="L0 (Lmax)"
                  value={latestVL?.l0}
                  unit="kg"
                  decimals={1}
                  color="#4CAF50"
                  sub={l0Delta != null ? `${l0Delta >= 0 ? '+' : ''}${l0Delta} vs prev` : 'last session'}
                />
                <KPICard
                  label="R² (fit quality)"
                  value={latestVL?.r_squared != null ? latestVL.r_squared * 100 : null}
                  unit="%"
                  decimals={1}
                  color={latestVL?.r_squared >= 0.95 ? '#4CAF50' : latestVL?.r_squared >= 0.85 ? '#F5C400' : '#F44336'}
                  sub="regression quality"
                />
                <KPICard
                  label="Sets used"
                  value={latestVL?.n_sets}
                  decimals={0}
                  color="var(--text-secondary)"
                  sub="last session"
                />
              </div>

              {/* Trend charts + scatter side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div className="card">
                  <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>V0 (Vmax) trend</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Theoretical unloaded velocity over time</div>
                  <TrendLineChart
                    data={vlProfile}
                    lines={[{ key: 'v0', name: 'V0 (m/s)', color: '#C8E600' }]}
                    height={200}
                  />
                </div>
                <div className="card">
                  <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>L0 (Lmax) trend</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Theoretical max load over time</div>
                  <TrendLineChart
                    data={vlProfile}
                    lines={[{ key: 'l0', name: 'L0 (kg)', color: '#4CAF50' }]}
                    height={200}
                  />
                </div>
                <div className="card">
                  <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
                    Latest session profile
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                      {latestVL?.session_date}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Dots = sets · dashed line = regression
                  </div>
                  {latestVL && (
                    <VLScatterChart
                      points={latestVL.points}
                      v0={latestVL.v0}
                      l0={latestVL.l0}
                      r2={latestVL.r_squared}
                      nSets={latestVL.n_sets}
                      height={200}
                    />
                  )}
                </div>
              </div>

              {/* History table */}
              <div className="card" style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>V-L Profile history</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="vpa-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>V0 (m/s)</th><th>L0 (kg)</th>
                        <th>Slope</th><th>R²</th><th>Sets</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...vlProfile].reverse().map((r, i) => (
                        <tr key={i}>
                          <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.session_date}</td>
                          <td style={{ color: '#C8E600', fontWeight: 500 }}>{r.v0?.toFixed(3)}</td>
                          <td style={{ color: '#4CAF50', fontWeight: 500 }}>{r.l0?.toFixed(1) ?? '—'}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{r.slope?.toFixed(4)}</td>
                          <td>
                            <span className={`badge ${r.r_squared >= 0.95 ? 'badge-green' : r.r_squared >= 0.85 ? 'badge-amber' : 'badge-red'}`}>
                              {r.r_squared != null ? `${(r.r_squared * 100).toFixed(1)}%` : '—'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{r.n_sets}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : vlProfile.length === 1 ? (
            <div className="card" style={{ marginBottom: '20px', textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
              Only 1 session found for this exercise — need ≥2 sessions to show V-L trend.
            </div>
          ) : null}
        </>
      )}

      {/* Session vs PB table */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>Session summary (set by set)</div>
          <button className="toggle-btn" onClick={() => downloadCsv(focusedSessionData,
            'gymaware-sessions.csv',
            ['session_date','athlete_display_name','exercise_name','bar_weight','rep_count',
             'todays_mean_velocity','todays_peak_velocity','pct_of_pb_mean','pct_of_pb_peak',
             'pb_mean_velocity','pb_peak_velocity']
          )}>⬇ Export CSV</button>
        </div>
        {sessLoading ? <LoadingSpinner /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="vpa-table">
              <thead>
                <tr>
                  <th>Date</th>
                  {!selectedAthlete && <th>Athlete</th>}
                  <th>Exercise</th><th>Load (kg)</th><th>Reps</th>
                  <th>Mean Vel</th><th>Peak Vel</th>
                  <th>% PB Mean</th><th>% PB Peak</th>
                  <th>PB Mean</th><th>PB Peak</th><th>PB Date</th>
                </tr>
              </thead>
              <tbody>
                {focusedSessionData.slice(0, 100).map((r, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.session_date || r.calendar_date}</td>
                    {!selectedAthlete && <td style={{ fontWeight: 500 }}>{r.athlete_display_name}</td>}
                    <td>{r.exercise_name}</td>
                    <td>{r.bar_weight}</td>
                    <td>{r.rep_count}</td>
                    <td>{r.todays_mean_velocity?.toFixed(2) ?? '—'}</td>
                    <td>{r.todays_peak_velocity?.toFixed(2) ?? '—'}</td>
                    <td><PctBadge value={r.pct_of_pb_mean} /></td>
                    <td><PctBadge value={r.pct_of_pb_peak} /></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{r.pb_mean_velocity?.toFixed(2) ?? '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{r.pb_peak_velocity?.toFixed(2) ?? '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{r.pb_date ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PB table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>Personal best records</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            ⚠ PBs reflect current dataset only — not all-time records
          </div>
        </div>
        {pbLoading ? <LoadingSpinner /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="vpa-table">
              <thead>
                <tr>
                  {!selectedAthlete && <th>Athlete</th>}
                  <th>Exercise</th><th>Load (kg)</th>
                  <th>PB Mean Vel</th><th>PB Peak Vel</th><th>PB Date</th>
                </tr>
              </thead>
              <tbody>
                {pbData.map((r, i) => (
                  <tr key={i}>
                    {!selectedAthlete && <td style={{ fontWeight: 500 }}>{r.athlete_display_name}</td>}
                    <td>{r.exercise_name}</td>
                    <td>{r.bar_weight}</td>
                    <td style={{ color: '#C8E600', fontWeight: 500 }}>{r.pb_mean_velocity?.toFixed(2) ?? '—'}</td>
                    <td style={{ color: '#C8E600', fontWeight: 500 }}>{r.pb_peak_velocity?.toFixed(2) ?? '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{r.pb_date ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

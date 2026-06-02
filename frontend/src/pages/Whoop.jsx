import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { whoopApi } from '../services/api'
import { useDashboard } from '../context/DashboardContext'
import KPICard from '../components/ui/KPICard'
import PageHeader from '../components/ui/PageHeader'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import DateRangePicker from '../components/ui/DateRangePicker'
import LastSync from '../components/ui/LastSync'
import TrendLineChart from '../components/charts/TrendLineChart'
import { downloadCsv } from '../utils/csvExport'
import StatusBadge, { recoveryBadge } from '../components/ui/StatusBadge'

const recoveryColor = (v) =>
  v == null ? 'var(--text-secondary)' : v >= 67 ? '#4CAF50' : v >= 34 ? '#F5C400' : '#F44336'

// Mini horizontal bar showing sleep stage proportions
function SleepBar({ deep, rem, light, total }) {
  if (!total) return <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
  const pct = (h) => h ? Math.round((h / total) * 100) : 0
  return (
    <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', width: '80px', gap: '1px' }}>
      <div style={{ width: `${pct(deep)}%`,  background: '#2196F3', borderRadius: '2px' }} title={`Deep: ${deep}h`} />
      <div style={{ width: `${pct(rem)}%`,   background: '#9C27B0', borderRadius: '2px' }} title={`REM: ${rem}h`} />
      <div style={{ width: `${pct(light)}%`, background: '#4CAF50', borderRadius: '2px' }} title={`Light: ${light}h`} />
    </div>
  )
}

export default function Whoop() {
  const { selectedAthlete } = useDashboard()
  const [searchParams, setSearchParams] = useSearchParams()
  const focusedDay = searchParams.get('day')
  const [days, setDays] = useState(14)
  const [tab, setTab] = useState('recovery')
  const navigate = useNavigate()

  const params = { days, ...(selectedAthlete ? { athlete_key: selectedAthlete } : {}) }

  const { data: recovery = [], isLoading } = useQuery({
    queryKey: ['whoop-recovery', params],
    queryFn: () => whoopApi.recovery(params),
  })

  const { data: trend = [] } = useQuery({
    queryKey: ['hrv-trend', params],
    queryFn: () => whoopApi.hrvTrend(params),
  })

  const { data: workouts = [], isLoading: workoutLoading } = useQuery({
    queryKey: ['whoop-workout', params],
    queryFn: () => whoopApi.workout(params),
  })

  const latest = recovery[0] ?? {}
  const focusedRecovery = focusedDay
    ? recovery.filter(r => (r.session_date || r.calendar_date) === focusedDay)
    : recovery
  const focusedWorkouts = focusedDay
    ? workouts.filter(r => (r.session_date || r.calendar_date) === focusedDay)
    : workouts

  // Compute personal HRV baseline from trend data (mean over the window)
  const hrvVals = trend.filter(r => r.hrv_rmssd_milli != null)
  const hrvBaseline = hrvVals.length
    ? Math.round(hrvVals.reduce((s, r) => s + r.hrv_rmssd_milli, 0) / hrvVals.length)
    : null

  useEffect(() => {
    if (!focusedDay) return
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const d = new Date(`${focusedDay}T00:00:00`)
    if (Number.isNaN(d.getTime())) return
    const needed = Math.max(1, Math.ceil((today.getTime() - d.getTime()) / 86400000) + 1)
    if (needed > days) setDays(Math.min(365, needed))
  }, [focusedDay, days])

  return (
    <div className="page-enter" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader title="Whoop" subtitle="HRV, resting heart rate, sleep & recovery scores">
        <LastSync data={recovery} />
        {selectedAthlete && (
          <button className="toggle-btn" onClick={() => navigate('/report')}
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            🖨 Report
          </button>
        )}
        <div className="toggle-group">
          {[
            { id: 'recovery', label: 'Recovery' },
            { id: 'sleep',    label: 'Sleep' },
            { id: 'workout',  label: 'Workouts' },
          ].map(t => (
            <button key={t.id}
              className={`toggle-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >{t.label}</button>
          ))}
        </div>
        <DateRangePicker days={days} onChange={setDays} />
      </PageHeader>

      {focusedDay && (
        <div className="card" style={{ marginBottom: '12px', padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Focused day: <strong style={{ color: 'var(--text-primary)' }}>{focusedDay}</strong>. Tables below are filtered to this date.
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

      {/* Linking note */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 14px', marginBottom: '20px',
        background: 'rgba(245,196,0,0.08)',
        border: '1px solid rgba(245,196,0,0.2)',
        borderRadius: '10px', fontSize: '12px', color: '#FFD54F',
      }}>
        <span>⚠</span>
        WHOOP user linking in progress. Tom Hodges pending. Solomon Bushby inactive. Data shown for linked athletes only.
      </div>

      {/* ── RECOVERY TAB ── */}
      {tab === 'recovery' && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <KPICard label="HRV (rMSSD)"       value={latest.hrv_rmssd_milli}           unit="ms"  decimals={0} color="#2196F3" sub="last reading" />
            <KPICard label="Resting HR"         value={latest.resting_heart_rate}         unit="bpm" decimals={0} color="#F44336" sub="last reading" />
            <KPICard label="Recovery Score"     value={latest.recovery_score}             unit="%"   decimals={0} color={recoveryColor(latest.recovery_score)} sub="today" />
            <KPICard label="Cycle Strain"       value={latest.cycle_strain}               decimals={1} color="#F5C400" sub="yesterday" />
            <KPICard label="SpO2"               value={latest.spo2_percentage}            unit="%"   decimals={1} color="#4CAF50" sub="last reading" />
            <KPICard label="Skin Temp"          value={latest.skin_temp_celsius}          unit="°C"  decimals={1} color="#FF9800" sub="last reading" />
          </div>

          {/* HRV + RHR chart */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>HRV + Resting Heart Rate</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              HRV rising + RHR falling = good adaptation
            </div>
            {isLoading ? <LoadingSpinner /> : (
              <TrendLineChart
                data={trend}
                lines={[
                  { key: 'hrv_rmssd_milli',    name: 'HRV (ms)',       color: '#2196F3' },
                  { key: 'resting_heart_rate',  name: 'Resting HR',    color: '#F44336', dashed: true },
                ]}
                height={240}
                referenceLine={hrvBaseline
                  ? { value: hrvBaseline, label: `Baseline: ${hrvBaseline} ms`, color: '#64B5F6' }
                  : null
                }
              />
            )}
          </div>

          {/* Recovery + Strain charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div className="card">
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>Recovery score %</div>
              <TrendLineChart
                data={trend}
                lines={[{ key: 'recovery_score', name: 'Recovery %', color: '#4CAF50' }]}
                height={180}
              />
            </div>
            <div className="card">
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>Cycle strain</div>
              <TrendLineChart
                data={trend}
                lines={[{ key: 'cycle_strain', name: 'Strain', color: '#F5C400' }]}
                height={180}
              />
            </div>
          </div>

          {/* Recovery log table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>Recovery log</div>
              <button className="toggle-btn" onClick={() => downloadCsv(focusedRecovery,
                'whoop-recovery.csv',
                ['session_date','athlete_display_name','hrv_rmssd_milli','resting_heart_rate',
                 'recovery_score','cycle_strain','spo2_percentage','skin_temp_celsius']
              )}>⬇ Export CSV</button>
            </div>
            {isLoading ? <LoadingSpinner /> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="vpa-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      {!selectedAthlete && <th>Athlete</th>}
                      <th>HRV (ms)</th><th>Resting HR</th><th>Recovery</th>
                      <th>Strain</th><th>SpO2</th><th>Skin Temp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {focusedRecovery.map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.session_date || r.calendar_date}</td>
                        {!selectedAthlete && <td style={{ fontWeight: 500 }}>{r.athlete_display_name}</td>}
                        <td style={{ color: '#64B5F6', fontWeight: 500 }}>{r.hrv_rmssd_milli?.toFixed(0) ?? '—'}</td>
                        <td style={{ color: '#EF9A9A' }}>{r.resting_heart_rate ? `${r.resting_heart_rate} bpm` : '—'}</td>
                        <td>
                          {(() => {
                            const b = recoveryBadge(r.recovery_score)
                            const label = r.recovery_score != null ? `${r.recovery_score.toFixed(0)}%` : b.label
                            return <StatusBadge label={label} tone={b.tone} title={b.title} />
                          })()}
                        </td>
                        <td style={{ color: '#F5C400' }}>{r.cycle_strain?.toFixed(1) ?? '—'}</td>
                        <td>{r.spo2_percentage != null ? `${r.spo2_percentage.toFixed(0)}%` : '—'}</td>
                        <td>{r.skin_temp_celsius != null ? `${r.skin_temp_celsius.toFixed(1)}°C` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── SLEEP TAB ── */}
      {tab === 'sleep' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <KPICard label="Sleep Performance" value={latest.sleep_performance_percentage} unit="%" decimals={0} color="#9C27B0" sub="last night" />
            <KPICard label="Sleep Efficiency"  value={latest.sleep_efficiency_percentage}  unit="%" decimals={0} color="#C8E600" sub="last night" />
            <KPICard label="In Bed"            value={latest.in_bed_hours}                 unit="h" decimals={1} color="var(--text-secondary)" sub="last night" />
            <KPICard label="Deep Sleep"        value={latest.deep_hours}                   unit="h" decimals={1} color="#2196F3"  sub="slow-wave" />
            <KPICard label="REM Sleep"         value={latest.rem_hours}                    unit="h" decimals={1} color="#9C27B0"  sub="last night" />
            <KPICard label="Light Sleep"       value={latest.light_hours}                  unit="h" decimals={1} color="#4CAF50"  sub="last night" />
          </div>

          {/* Sleep performance trend */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>Sleep performance %</div>
            <TrendLineChart
              data={recovery}
              lines={[{ key: 'sleep_performance_percentage', name: 'Sleep %', color: '#9C27B0' }]}
              height={200}
            />
          </div>

          {/* Sleep log table */}
          <div className="card">
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>Sleep log</div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span><span style={{ color: '#2196F3' }}>■</span> Deep</span>
              <span><span style={{ color: '#9C27B0' }}>■</span> REM</span>
              <span><span style={{ color: '#4CAF50' }}>■</span> Light</span>
            </div>
            {isLoading ? <LoadingSpinner /> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="vpa-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      {!selectedAthlete && <th>Athlete</th>}
                      <th>Performance</th><th>Efficiency</th>
                      <th>In Bed</th><th>Deep</th><th>REM</th><th>Light</th>
                      <th>Stages</th>
                    </tr>
                  </thead>
                  <tbody>
                  {focusedRecovery.map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.session_date || r.calendar_date}</td>
                        {!selectedAthlete && <td style={{ fontWeight: 500 }}>{r.athlete_display_name}</td>}
                        <td style={{ color: '#CE93D8', fontWeight: 500 }}>
                          {r.sleep_performance_percentage != null ? `${r.sleep_performance_percentage.toFixed(0)}%` : '—'}
                        </td>
                        <td>{r.sleep_efficiency_percentage != null ? `${r.sleep_efficiency_percentage.toFixed(0)}%` : '—'}</td>
                        <td>{r.in_bed_hours != null ? `${r.in_bed_hours}h` : '—'}</td>
                        <td style={{ color: '#64B5F6' }}>{r.deep_hours  != null ? `${r.deep_hours}h`  : '—'}</td>
                        <td style={{ color: '#CE93D8' }}>{r.rem_hours   != null ? `${r.rem_hours}h`   : '—'}</td>
                        <td style={{ color: '#A5D6A7' }}>{r.light_hours != null ? `${r.light_hours}h` : '—'}</td>
                        <td>
                          <SleepBar
                            deep={r.deep_hours} rem={r.rem_hours}
                            light={r.light_hours} total={r.in_bed_hours}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── WORKOUTS TAB ── */}
      {tab === 'workout' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <KPICard label="Workout Strain"  value={workouts[0]?.strain}            decimals={1} color="#F5C400"  sub="last session" />
            <KPICard label="Avg HR"          value={workouts[0]?.average_heart_rate} unit="bpm" decimals={0} color="#F44336" sub="last session" />
            <KPICard label="Max HR"          value={workouts[0]?.max_heart_rate}     unit="bpm" decimals={0} color="#EF5350" sub="last session" />
            <KPICard label="Kilojoules"      value={workouts[0]?.kilojoule}          unit="kJ"  decimals={0} color="#FF9800" sub="last session" />
            <KPICard label="Calories"        value={workouts[0]?.calories_kcal}      unit="kcal" decimals={0} color="#FF9800" sub="last session" />
            <KPICard label="Sessions"        value={focusedWorkouts.length}          decimals={0} color="var(--text-secondary)" sub={focusedDay ? focusedDay : `last ${days} days`} />
          </div>

          {/* Workout strain trend */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>Workout strain trend</div>
            <TrendLineChart
              data={workouts}
              lines={[{ key: 'strain', name: 'Workout Strain', color: '#F5C400' }]}
              height={200}
            />
          </div>

          {/* Workout log table */}
          <div className="card">
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>Workout log</div>
            {workoutLoading ? <LoadingSpinner /> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="vpa-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      {!selectedAthlete && <th>Athlete</th>}
                      <th>Sport</th><th>Strain</th>
                      <th>Avg HR</th><th>Max HR</th>
                      <th>Duration</th><th>kJ</th><th>Calories</th>
                    </tr>
                  </thead>
                  <tbody>
                    {focusedWorkouts.map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.session_date || r.calendar_date}</td>
                        {!selectedAthlete && <td style={{ fontWeight: 500 }}>{r.athlete_display_name}</td>}
                        <td style={{ fontWeight: 500 }}>{r.sport_name ?? '—'}</td>
                        <td style={{ color: '#F5C400', fontWeight: 500 }}>{r.strain?.toFixed(1) ?? '—'}</td>
                        <td>{r.average_heart_rate ? `${r.average_heart_rate} bpm` : '—'}</td>
                        <td style={{ color: '#EF5350' }}>{r.max_heart_rate ? `${r.max_heart_rate} bpm` : '—'}</td>
                        <td>{r.total_workout_hours != null ? `${r.total_workout_hours}h` : '—'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{r.kilojoule?.toFixed(0) ?? '—'}</td>
                        <td style={{ color: '#FF9800' }}>{r.calories_kcal != null ? `${r.calories_kcal} kcal` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

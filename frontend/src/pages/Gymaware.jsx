import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { gymawareApi } from '../services/api'
import { useDashboard } from '../context/DashboardContext'
import KPICard from '../components/ui/KPICard'
import PageHeader from '../components/ui/PageHeader'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import SelectDropdown from '../components/ui/SelectDropdown'
import TrendLineChart from '../components/charts/TrendLineChart'

function PctBadge({ value }) {
  if (value == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const cls = value >= 90 ? 'badge-green' : value >= 75 ? 'badge-amber' : 'badge-red'
  return <span className={`badge ${cls}`}>{value.toFixed(1)}%</span>
}

export default function Gymaware() {
  const { selectedAthlete } = useDashboard()
  const [exercise, setExercise] = useState('')
  const [days, setDays] = useState(30)

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

  const latestDate = sessionData[0]?.session_date || sessionData[0]?.calendar_date
  const latestSets = sessionData.filter(r => (r.session_date || r.calendar_date) === latestDate)
  const avgPctPeak = latestSets.length
    ? latestSets.reduce((s, r) => s + (r.pct_of_pb_peak ?? 0), 0) / latestSets.length
    : null

  return (
    <div className="page-enter" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader title="Gymaware" subtitle="Session summary, personal bests & velocity trends">
        <SelectDropdown
          options={exercises}
          value={exercise}
          onChange={setExercise}
          placeholder="All exercises"
          minWidth={200}
        />
        <div className="toggle-group">
          {[14, 30, 90].map(d => (
            <button key={d} className={`toggle-btn ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>
              {d}d
            </button>
          ))}
        </div>
      </PageHeader>

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

      {/* Session vs PB table */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>Session summary — set by set</div>
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
                {sessionData.slice(0, 100).map((r, i) => (
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
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>Personal best records</div>
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

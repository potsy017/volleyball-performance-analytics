import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { dashboardApi } from '../services/api'
import { useDashboard } from '../context/DashboardContext'
import KPICard from '../components/ui/KPICard'
import PageHeader from '../components/ui/PageHeader'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import ComboChart from '../components/charts/ComboChart'
import TrendLineChart from '../components/charts/TrendLineChart'

const WINDOWS = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '28 days', value: 28 },
]

const METRIC_TOGGLES = [
  { id: 'player_load', label: 'Player Load', color: '#4CAF50' },
  { id: 'high_jumps',  label: 'High Jumps',  color: '#C8E600' },
  { id: 'hrv',         label: 'HRV',         color: '#2196F3' },
  { id: 'velocity',    label: 'Peak Velocity', color: '#F5C400' },
]

export default function MainDashboard() {
  const { selectedAthlete, days, setDays } = useDashboard()
  const [activeMetrics, setActiveMetrics] = useState(['player_load', 'high_jumps', 'hrv'])
  const [kpiMode, setKpiMode] = useState('latest')   // 'latest' | 'avg'
  const navigate = useNavigate()

  const params = { days, ...(selectedAthlete ? { athlete_key: selectedAthlete } : {}) }

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['kpis', params],
    queryFn: () => dashboardApi.kpis(params),
  })

  const { data: summary = [], isLoading: summaryLoading } = useQuery({
    queryKey: ['summary', params],
    queryFn: () => dashboardApi.summary(params),
  })

  const { data: teamSnapshot = [], isLoading: snapshotLoading } = useQuery({
    queryKey: ['team-snapshot'],
    queryFn: dashboardApi.teamSnapshot,
    enabled: !selectedAthlete,
  })

  const catapultRows = summary.filter(r => r.source === 'catapult')
  const whoopRows    = summary.filter(r => r.source === 'whoop')

  const toggleMetric = (id) => {
    setActiveMetrics(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  const recoveryStatus = (score) => {
    if (score == null) return { label: 'No data', cls: 'badge-gray' }
    if (score >= 67) return { label: 'Good',    cls: 'badge-green' }
    if (score >= 34) return { label: 'Monitor', cls: 'badge-amber' }
    return              { label: 'Low',     cls: 'badge-red' }
  }

  return (
    <div className="page-enter" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader title="Player Perfomance Analysis" subtitle="Explore & overlay metrics across all sources">
        {/* Latest / Avg toggle — always visible */}
        <div className="toggle-group">
          {['latest', 'avg'].map(mode => (
            <button
              key={mode}
              className={`toggle-btn ${kpiMode === mode ? 'active' : ''}`}
              onClick={() => setKpiMode(mode)}
            >
              {mode === 'latest' ? 'Latest' : `${days}d Avg`}
            </button>
          ))}
        </div>
        <div className="toggle-group">
          {WINDOWS.map(w => (
            <button
              key={w.value}
              className={`toggle-btn ${days === w.value ? 'active' : ''}`}
              onClick={() => setDays(w.value)}
            >
              {w.label}
            </button>
          ))}
        </div>
      </PageHeader>

      {/* Metric toggles */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {METRIC_TOGGLES.map(m => (
          <button
            key={m.id}
            onClick={() => toggleMetric(m.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              border: activeMetrics.includes(m.id)
                ? `1px solid ${m.color}40`
                : '1px solid var(--border)',
              background: activeMetrics.includes(m.id)
                ? `${m.color}15`
                : 'transparent',
              color: activeMetrics.includes(m.id) ? m.color : 'var(--text-secondary)',
              fontSize: '12px', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: activeMetrics.includes(m.id) ? m.color : 'var(--text-muted)',
            }} />
            {m.label}
          </button>
        ))}
      </div>

      {/* KPI Row */}
      {kpisLoading ? <LoadingSpinner message="Loading metrics..." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {selectedAthlete && kpiMode === 'latest' ? (
            /* Individual athlete — LATEST SESSION */
            <>
              <KPICard label="Player Load" value={kpis?.latest_player_load} decimals={0}
                sub={kpis?.latest_session_date ? `latest · ${kpis.latest_session_date}` : 'latest session'} />
              <KPICard label="Load / min" value={kpis?.latest_load_per_min} decimals={2}
                sub="latest session" color="#C8E600" />
              <KPICard label="High Jumps" value={kpis?.latest_high_jumps} decimals={0}
                sub="latest session" color="#F5C400" />
              <KPICard label="HRV (rMSSD)" value={kpis?.latest_hrv} unit="ms" decimals={0}
                sub={kpis?.latest_recovery_date ? `latest · ${kpis.latest_recovery_date}` : 'latest'}
                color="#2196F3" />
              <KPICard label="Recovery" value={kpis?.latest_recovery} unit="%" decimals={0}
                sub="latest score"
                color={kpis?.latest_recovery >= 67 ? '#4CAF50' : kpis?.latest_recovery >= 34 ? '#F5C400' : '#F44336'} />
              <KPICard label="Sessions" value={kpis?.sessions_count} decimals={0}
                sub={`last ${days} days`} color="var(--text-secondary)" />
            </>
          ) : selectedAthlete && kpiMode === 'avg' ? (
            /* Individual athlete — PERIOD AVERAGES */
            <>
              <KPICard label="Avg Load / min" value={kpis?.avg_player_load_per_min} decimals={2}
                sub={`${days}-day avg`} />
              <KPICard label="Avg High Jumps" value={kpis?.avg_high_jumps} decimals={0}
                sub={`${days}-day avg`} color="#F5C400" />
              <KPICard label="Avg HRV" value={kpis?.avg_hrv} unit="ms" decimals={0}
                sub={`${days}-day avg`} color="#2196F3" />
              <KPICard label="Avg Recovery" value={kpis?.avg_recovery} unit="%" decimals={0}
                sub={`${days}-day avg`}
                color={kpis?.avg_recovery >= 67 ? '#4CAF50' : kpis?.avg_recovery >= 34 ? '#F5C400' : '#F44336'} />
              <KPICard label="Avg Resting HR" value={kpis?.avg_resting_hr} unit="bpm" decimals={0}
                sub={`${days}-day avg`} color="#F44336" />
              <KPICard label="Sessions" value={kpis?.sessions_count} decimals={0}
                sub={`last ${days} days`} color="var(--text-secondary)" />
            </>
          ) : kpiMode === 'latest' ? (
            /* All athletes — TEAM LATEST */
            <>
              <KPICard label="Player Load" value={kpis?.latest_player_load} decimals={0}
                sub={kpis?.latest_session_date ? `latest · ${kpis.latest_session_date}` : 'latest session'} />
              <KPICard label="Load / min" value={kpis?.latest_load_per_min} decimals={2}
                sub="latest session" color="#C8E600" />
              <KPICard label="High Jumps" value={kpis?.latest_high_jumps} decimals={0}
                sub="latest session" color="#F5C400" />
              <KPICard label="HRV (rMSSD)" value={kpis?.latest_hrv} unit="ms" decimals={0}
                sub={kpis?.latest_recovery_date ? `latest · ${kpis.latest_recovery_date}` : 'latest'}
                color="#2196F3" />
              <KPICard label="Recovery" value={kpis?.latest_recovery} unit="%" decimals={0}
                sub="latest score"
                color={kpis?.latest_recovery >= 67 ? '#4CAF50' : kpis?.latest_recovery >= 34 ? '#F5C400' : '#F44336'} />
              <KPICard label="Sessions" value={kpis?.sessions_count} decimals={0}
                sub={`last ${days} days`} color="var(--text-secondary)" />
            </>
          ) : (
            /* All athletes — TEAM AVERAGES */
            <>
              <KPICard label="Load / min" value={kpis?.avg_player_load_per_min} decimals={2} sub={`${days}-day avg`} />
              <KPICard label="High Jumps" value={kpis?.avg_high_jumps} decimals={0} sub="avg per session" color="#C8E600" />
              <KPICard label="HRV (rMSSD)" value={kpis?.avg_hrv} unit="ms" decimals={0} sub="team avg" color="#2196F3" />
              <KPICard label="Recovery" value={kpis?.avg_recovery} unit="%" decimals={0} sub="team avg"
                color={kpis?.avg_recovery >= 67 ? '#4CAF50' : '#F5C400'} />
              <KPICard label="Sessions" value={kpis?.sessions_count} decimals={0} sub={`last ${days} days`} color="var(--text-secondary)" />
            </>
          )}
        </div>
      )}

      {/* Charts */}
      {summaryLoading ? <LoadingSpinner message="Loading charts..." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          {activeMetrics.includes('player_load') && (
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Training Load</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>bars = player load · line = load/min</span>
              </div>
              <ComboChart
                data={catapultRows}
                barKey="total_player_load"
                lineKey="player_load_per_minute"
                barName="Player Load"
                lineName="Load / min"
                height={220}
              />
            </div>
          )}

          {activeMetrics.includes('high_jumps') && (
            <div className="card" onClick={() => navigate('/catapult')} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>High Jump Count</div>
              <TrendLineChart
                data={catapultRows}
                lines={[{ key: 'high_jump_count', name: 'High Jumps', color: '#C8E600' }]}
                height={200}
              />
            </div>
          )}

          {activeMetrics.includes('hrv') && (
            <div className="card" onClick={() => navigate('/whoop')} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>HRV + Resting HR</div>
              <TrendLineChart
                data={whoopRows}
                lines={[
                  { key: 'hrv_rmssd_milli', name: 'HRV (ms)', color: '#2196F3' },
                  { key: 'resting_heart_rate', name: 'Resting HR', color: '#F44336', dashed: true },
                ]}
                height={200}
              />
            </div>
          )}

          {activeMetrics.includes('velocity') && (
            <div className="card" onClick={() => navigate('/gymaware')} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>Peak Velocity Trend</div>
              <TrendLineChart
                data={summary.filter(r => r.source === 'gymaware')}
                lines={[{ key: 'peak_velocity', name: 'Peak Velocity', color: '#F5C400' }]}
                height={200}
              />
            </div>
          )}
        </div>
      )}

      {/* Team snapshot */}
      {!selectedAthlete && (
        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>Team snapshot — latest data per athlete</div>
          {snapshotLoading ? <LoadingSpinner /> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="vpa-table">
                <thead>
                  <tr>
                    <th>#</th><th>Athlete</th><th>Last Session</th>
                    <th>Player Load</th><th>Load/min</th>
                    <th>High Jumps</th><th>HRV</th><th>Recovery</th>
                  </tr>
                </thead>
                <tbody>
                  {teamSnapshot.map(a => {
                    const status = recoveryStatus(a.recovery)
                    return (
                      <tr key={a.athlete_internal_key} style={{ cursor: 'pointer' }}>
                        <td style={{ color: 'var(--text-muted)' }}>{a.jersey || '—'}</td>
                        <td style={{ fontWeight: 500 }}>{a.athlete_name}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{a.last_session || '—'}</td>
                        <td>{a.player_load?.toFixed(0) ?? '—'}</td>
                        <td>{a.load_per_min?.toFixed(2) ?? '—'}</td>
                        <td>{a.high_jumps ?? '—'}</td>
                        <td>{a.hrv ? `${a.hrv.toFixed(0)} ms` : '—'}</td>
                        <td><span className={`badge ${status.cls}`}>{status.label}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

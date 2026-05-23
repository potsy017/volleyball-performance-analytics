import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { whoopApi } from '../services/api'
import { useDashboard } from '../context/DashboardContext'
import KPICard from '../components/ui/KPICard'
import PageHeader from '../components/ui/PageHeader'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import TrendLineChart from '../components/charts/TrendLineChart'

export default function Whoop() {
  const { selectedAthlete } = useDashboard()
  const [days, setDays] = useState(14)

  const params = { days, ...(selectedAthlete ? { athlete_key: selectedAthlete } : {}) }

  const { data: recovery = [], isLoading } = useQuery({
    queryKey: ['whoop-recovery', params],
    queryFn: () => whoopApi.recovery(params),
  })

  const { data: trend = [] } = useQuery({
    queryKey: ['hrv-trend', params],
    queryFn: () => whoopApi.hrvTrend(params),
  })

  const latest = recovery[0] ?? {}
  const avgHrv = recovery.length
    ? recovery.reduce((s, r) => s + (r.hrv_rmssd_milli ?? 0), 0) / recovery.filter(r => r.hrv_rmssd_milli != null).length
    : null

  const recoveryColor = (v) => v == null ? 'var(--text-secondary)' : v >= 67 ? '#4CAF50' : v >= 34 ? '#F5C400' : '#F44336'

  return (
    <div className="page-enter" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader title="WHOOP — Recovery" subtitle="HRV, resting heart rate, sleep & recovery scores">
        <div className="toggle-group">
          {[7, 14, 28].map(d => (
            <button key={d} className={`toggle-btn ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>
              {d}d
            </button>
          ))}
        </div>
      </PageHeader>

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

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <KPICard label="HRV (rMSSD)" value={latest.hrv_rmssd_milli} unit="ms" decimals={0} color="#2196F3" sub="last reading" />
        <KPICard label="Resting HR" value={latest.resting_heart_rate} unit="bpm" decimals={0} color="#F44336" sub="last reading" />
        <KPICard label="Recovery Score" value={latest.recovery_score} unit="%" decimals={0}
          color={recoveryColor(latest.recovery_score)} sub="today" />
        <KPICard label="Sleep Performance" value={latest.sleep_performance_percentage} unit="%" decimals={0} color="#9C27B0" sub="last night" />
        <KPICard label="Sleep Efficiency" value={latest.sleep_efficiency_percentage} unit="%" decimals={0} color="#C8E600" sub="last night" />
        <KPICard label="Cycle Strain" value={latest.cycle_strain} decimals={1} color="#F5C400" sub="yesterday" />
      </div>

      {/* HRV + Resting HR chart */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>HRV + Resting Heart Rate</div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Primary recovery indicators — HRV rising + RHR falling = good adaptation
        </div>
        {isLoading ? <LoadingSpinner /> : (
          <TrendLineChart
            data={trend}
            lines={[
              { key: 'hrv_rmssd_milli',  name: 'HRV (rMSSD ms)', color: '#2196F3' },
              { key: 'resting_heart_rate', name: 'Resting HR (bpm)', color: '#F44336', dashed: true },
            ]}
            height={240}
          />
        )}
      </div>

      {/* Recovery + sleep charts */}
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
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>Sleep performance %</div>
          <TrendLineChart
            data={recovery}
            lines={[{ key: 'sleep_performance_percentage', name: 'Sleep %', color: '#9C27B0' }]}
            height={180}
          />
        </div>
      </div>

      {/* Recovery log */}
      <div className="card">
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>Recovery log</div>
        {isLoading ? <LoadingSpinner /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="vpa-table">
              <thead>
                <tr>
                  <th>Date</th>
                  {!selectedAthlete && <th>Athlete</th>}
                  <th>HRV (ms)</th><th>Resting HR</th><th>Recovery</th>
                  <th>Sleep</th><th>Strain</th><th>SpO2</th>
                </tr>
              </thead>
              <tbody>
                {recovery.map((r, i) => {
                  const recScore = r.recovery_score
                  const cls = recScore == null ? 'badge-gray' : recScore >= 67 ? 'badge-green' : recScore >= 34 ? 'badge-amber' : 'badge-red'
                  return (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.session_date || r.calendar_date}</td>
                      {!selectedAthlete && <td style={{ fontWeight: 500 }}>{r.athlete_display_name}</td>}
                      <td style={{ color: '#64B5F6', fontWeight: 500 }}>{r.hrv_rmssd_milli?.toFixed(0) ?? '—'}</td>
                      <td style={{ color: '#EF9A9A' }}>{r.resting_heart_rate ? `${r.resting_heart_rate} bpm` : '—'}</td>
                      <td><span className={`badge ${cls}`}>{recScore != null ? `${recScore.toFixed(0)}%` : '—'}</span></td>
                      <td>{r.sleep_performance_percentage != null ? `${r.sleep_performance_percentage.toFixed(0)}%` : '—'}</td>
                      <td>{r.cycle_strain?.toFixed(1) ?? '—'}</td>
                      <td>{r.spo2_percentage != null ? `${r.spo2_percentage.toFixed(0)}%` : '—'}</td>
                    </tr>
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

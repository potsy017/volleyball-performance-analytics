import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { catapultApi } from '../services/api'
import { useDashboard } from '../context/DashboardContext'
import KPICard from '../components/ui/KPICard'
import PageHeader from '../components/ui/PageHeader'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import SelectDropdown from '../components/ui/SelectDropdown'
import DateRangePicker from '../components/ui/DateRangePicker'
import LastSync from '../components/ui/LastSync'
import ComboChart from '../components/charts/ComboChart'
import TrendLineChart from '../components/charts/TrendLineChart'
import { downloadCsv } from '../utils/csvExport'

export default function Catapult() {
  const { selectedAthlete } = useDashboard()
  const [days, setDays] = useState(14)
  const navigate = useNavigate()
  const [activity, setActivity] = useState('')

  const params = {
    days,
    ...(selectedAthlete ? { athlete_key: selectedAthlete } : {}),
    ...(activity ? { activity } : {}),
  }

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['cat-sessions', params],
    queryFn: () => catapultApi.sessions(params),
  })

  const { data: activities = [] } = useQuery({
    queryKey: ['cat-activities'],
    queryFn: () => catapultApi.activities(selectedAthlete ? { athlete_key: selectedAthlete } : {}),
  })

  const { data: trend = [] } = useQuery({
    queryKey: ['cat-trend', { days, athlete_key: selectedAthlete }],
    queryFn: () => catapultApi.loadTrend({ days, ...(selectedAthlete ? { athlete_key: selectedAthlete } : {}) }),
  })

  const { data: acwrTrend = [] } = useQuery({
    queryKey: ['acwr-trend', { days, athlete_key: selectedAthlete }],
    queryFn: () => catapultApi.acwrTrend({ days, ...(selectedAthlete ? { athlete_key: selectedAthlete } : {}) }),
  })

  // Latest ACWR row for KPI cards + traffic light colour (coach's bounds: 0.8–1.4 green)
  const latestAcwrRow  = acwrTrend.length ? acwrTrend[acwrTrend.length - 1] : null
  const latestAcwr     = latestAcwrRow?.acwr ?? null
  const latestAcute    = latestAcwrRow?.acute_load ?? null
  const latestChronic  = latestAcwrRow?.chronic_load ?? null
  const acwrColor      = latestAcwr == null ? 'var(--text-secondary)'
    : latestAcwr > 1.5 || latestAcwr < 0.5 ? '#F44336'
    : latestAcwr > 1.4 || latestAcwr < 0.8 ? '#F5C400'
    : '#4CAF50'

  const latest = sessions[0] ?? {}
  const avgLoad = sessions.length
    ? sessions.reduce((s, r) => s + (r.total_player_load ?? 0), 0) / sessions.length
    : null
  const avgJumps = sessions.length
    ? sessions.reduce((s, r) => s + (r.high_jump_count ?? 0), 0) / sessions.length
    : null

  return (
    <div className="page-enter" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader title="Catapult — Training Load" subtitle="Player load, high jumps & distance per session">
        <LastSync data={sessions} />
        {selectedAthlete && (
          <button className="toggle-btn" onClick={() => navigate('/report')}
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            🖨 Report
          </button>
        )}
        <SelectDropdown
          options={activities}
          value={activity}
          onChange={setActivity}
          placeholder="All activities"
          minWidth={180}
        />
        <DateRangePicker days={days} onChange={setDays} />
      </PageHeader>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <KPICard label="Player Load" value={latest.total_player_load} decimals={0} sub="last session" />
        <KPICard label="Load / min" value={latest.player_load_per_minute} decimals={2} sub="last session" color="#C8E600" />
        <KPICard label="High Jumps" value={latest.high_jump_count} decimals={0} sub="last session" color="#F5C400" />
        <KPICard label="Total Distance" value={latest.total_distance} unit="m" decimals={0} sub="last session" color="#2196F3" />
        <KPICard label="Avg Player Load" value={avgLoad} decimals={0} sub={`${days}-day avg`} color="var(--text-secondary)" />
        <KPICard label="Avg High Jumps" value={avgJumps} decimals={0} sub={`${days}-day avg`} color="var(--text-secondary)" />
        <KPICard label="Acute Load" value={latestAcute} decimals={1} color="#F5C400"
          sub="7-day avg AU/day" />
        <KPICard label="Chronic Load" value={latestChronic} decimals={1} color="#2196F3"
          sub="28-day avg AU/day" />
        <KPICard label="ACWR" value={latestAcwr} decimals={2} color={acwrColor}
          sub="acute ÷ chronic" />
      </div>

      {/* Combo chart */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <span>Player Load — volume vs intensity</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>bars = total load · line = load/min</span>
        </div>
        {isLoading ? <LoadingSpinner /> : (
          <ComboChart
            data={trend}
            barKey="total_player_load"
            lineKey="player_load_per_minute"
            barName="Player Load"
            lineName="Load / min"
            height={240}
          />
        )}
      </div>

      {/* ACWR chart with green-zone reference lines */}
      {acwrTrend.length > 0 && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>Acute:Chronic Workload Ratio (ACWR)</div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
              <span style={{ color: '#4CAF50' }}>● 0.8–1.4 green zone</span>
              <span style={{ color: '#F5C400' }}>● 1.4–1.5 caution</span>
              <span style={{ color: '#F44336' }}>● &gt;1.5 high risk</span>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            7-day avg load ÷ 28-day avg load · stay between the dashed lines
          </div>
          <TrendLineChart
            data={acwrTrend}
            lines={[{ key: 'acwr', name: 'ACWR', color: acwrColor }]}
            height={200}
            referenceLines={[
              { value: 1.4, label: '1.4 upper',  color: '#F5C400' },
              { value: 0.8, label: '0.8 lower',  color: '#F5C400' },
            ]}
          />
        </div>
      )}

      {/* High jumps trend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>High jump count</div>
          <TrendLineChart
            data={trend}
            lines={[{ key: 'high_jump_count', name: 'High Jumps', color: '#C8E600' }]}
            height={200}
          />
        </div>
        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>Total distance (m)</div>
          <TrendLineChart
            data={trend}
            lines={[{ key: 'total_distance', name: 'Distance (m)', color: '#2196F3' }]}
            height={200}
          />
        </div>
      </div>

      {/* Session log table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>Session log</div>
          <button className="toggle-btn" onClick={() => downloadCsv(sessions,
            'catapult-sessions.csv',
            ['session_date','athlete_display_name','activity_name','total_player_load',
             'player_load_per_minute','high_jump_count','session_jump_count','total_distance','field_time']
          )}>⬇ Export CSV</button>
        </div>
        {isLoading ? <LoadingSpinner /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="vpa-table">
              <thead>
                <tr>
                  <th>Date</th>
                  {!selectedAthlete && <th>Athlete</th>}
                  <th>Activity</th><th>Player Load</th><th>Load/min</th>
                  <th>High Jumps</th><th>Total Jumps</th><th>Distance (m)</th><th>Field Time</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((r, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.session_date || r.calendar_date}</td>
                    {!selectedAthlete && <td style={{ fontWeight: 500 }}>{r.athlete_display_name}</td>}
                    <td>{r.activity_name ?? '—'}</td>
                    <td>{r.total_player_load?.toFixed(0) ?? '—'}</td>
                    <td style={{ color: '#C8E600', fontWeight: 500 }}>{r.player_load_per_minute?.toFixed(2) ?? '—'}</td>
                    <td style={{ color: '#F5C400' }}>{r.high_jump_count ?? '—'}</td>
                    <td>{r.session_jump_count ?? '—'}</td>
                    <td>{r.total_distance?.toFixed(0) ?? '—'}</td>
                    <td>{r.field_time?.toFixed(0) ?? '—'} min</td>
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

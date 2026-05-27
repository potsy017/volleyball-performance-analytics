import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { valdApi } from '../services/api'
import { useDashboard } from '../context/DashboardContext'
import KPICard from '../components/ui/KPICard'
import PageHeader from '../components/ui/PageHeader'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import SelectDropdown from '../components/ui/SelectDropdown'

const TEST_COLORS = {
  CMJ:   '#C8E600',
  RSKIP: '#4CAF50',
  IMTP:  '#2196F3',
}

export default function Vald() {
  const { selectedAthlete } = useDashboard()
  const [days, setDays] = useState(30)
  const [testType, setTestType] = useState('')

  const { data: testTypes = [] } = useQuery({
    queryKey: ['vald-test-types'],
    queryFn: valdApi.testTypes,
  })

  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ['vald-summary', selectedAthlete],
    queryFn: () => valdApi.summary(selectedAthlete ? { athlete_key: selectedAthlete } : {}),
  })

  const params = {
    days,
    ...(selectedAthlete ? { athlete_key: selectedAthlete } : {}),
    ...(testType ? { test_type: testType } : {}),
  }

  const { data: tests = [], isLoading: testsLoading } = useQuery({
    queryKey: ['vald-tests', params],
    queryFn: () => valdApi.tests(params),
  })

  return (
    <div className="page-enter" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader title="VALD ForceDecks" subtitle="Force plate test history and results">
        <SelectDropdown
          options={testTypes}
          value={testType}
          onChange={setTestType}
          placeholder="All test types"
          minWidth={180}
        />
        <div className="toggle-group">
          {[30, 90, 365].map(d => (
            <button key={d} className={`toggle-btn ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>
              {d === 365 ? 'All' : `${d}d`}
            </button>
          ))}
        </div>
      </PageHeader>

      {/* Info note */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 14px', marginBottom: '20px',
        background: 'rgba(33,150,243,0.08)',
        border: '1px solid rgba(33,150,243,0.2)',
        borderRadius: '10px', fontSize: '12px', color: '#64B5F6',
      }}>
        <span>ℹ</span>
        Full force plate metrics (jump height, peak force, asymmetry) will populate once the VALD ETL pipeline is extended.
      </div>

      {/* KPIs */}
      {sumLoading ? <LoadingSpinner /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <KPICard label="Total tests" value={summary?.total_tests} decimals={0} />
          <KPICard label="Test frequency" value={null} sub="see breakdown below" color="var(--text-secondary)" />
          <KPICard label="Last test" value={null} sub={summary?.last_test_date ?? '—'} color="#C8E600" />
          <KPICard label="Last type" value={null} sub={summary?.last_test_type ?? '—'} color="#4CAF50" />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {/* Test type breakdown */}
        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>Test type breakdown</div>
          {sumLoading ? <LoadingSpinner /> : (
            <table className="vpa-table">
              <thead>
                <tr><th>Test type</th><th>Count</th><th>Athletes</th></tr>
              </thead>
              <tbody>
                {(summary?.test_type_breakdown ?? []).map((t, i) => (
                  <tr key={i}>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: `${TEST_COLORS[t.test_type] || '#888'}20`,
                          color: TEST_COLORS[t.test_type] || '#888',
                        }}
                      >
                        {t.test_type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{t.count}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.athletes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{
            marginTop: '12px', padding: '10px 12px',
            background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
            fontSize: '12px', color: 'var(--text-secondary)',
          }}>
            Jump height, peak force, asymmetry index, RFD and contraction time will auto-populate once pipeline is updated.
          </div>
        </div>

        {/* Recent test timeline */}
        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>Recent test history</div>
          {sumLoading ? <LoadingSpinner /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {(summary?.recent_tests ?? []).slice(0, 12).map((t, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '9px 0',
                  borderBottom: i < 11 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{
                    width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                    background: TEST_COLORS[t.vald_test_type] || '#888',
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{t.vald_test_type}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {t.session_date} · {t.athlete_name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Full test log */}
      <div className="card">
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>Full test log</div>
        {testsLoading ? <LoadingSpinner /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="vpa-table">
              <thead>
                <tr>
                  <th>Date</th>
                  {!selectedAthlete && <th>Athlete</th>}
                  <th>Test type</th>
                  <th>Jump Height</th><th>Peak Force</th>
                  <th>Asymmetry</th><th>RFD</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((r, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.session_date}</td>
                    {!selectedAthlete && <td style={{ fontWeight: 500 }}>{r.athlete_name}</td>}
                    <td>
                      <span className="badge" style={{
                        background: `${TEST_COLORS[r.vald_test_type] || '#888'}20`,
                        color: TEST_COLORS[r.vald_test_type] || '#888',
                      }}>
                        {r.vald_test_type ?? '—'}
                      </span>
                    </td>
                    <td>{r.jump_height?.toFixed(2) ?? <span style={{ color: 'var(--text-muted)' }}>pending</span>}</td>
                    <td>{r.peak_force?.toFixed(0) ?? <span style={{ color: 'var(--text-muted)' }}>pending</span>}</td>
                    <td>{r.asymmetry_index != null ? `${r.asymmetry_index.toFixed(1)}%` : <span style={{ color: 'var(--text-muted)' }}>pending</span>}</td>
                    <td>{r.rfd?.toFixed(0) ?? <span style={{ color: 'var(--text-muted)' }}>pending</span>}</td>
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

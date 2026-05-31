import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../context/DashboardContext'
import { dashboardApi, catapultApi, whoopApi, gymawareApi } from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const REPORT_DAYS = 28

function StatBox({ label, value, unit = '', color = '#fff' }) {
  return (
    <div style={{
      border: '1px solid #ddd', borderRadius: '8px',
      padding: '12px 16px', textAlign: 'center', flex: 1, minWidth: '100px',
    }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color }}>{value ?? '—'}{value != null ? unit : ''}</div>
      <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>{label}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '24px', pageBreakInside: 'avoid' }}>
      <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700,
        borderBottom: '2px solid #00843D', paddingBottom: '4px', color: '#003d1e' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function ReportTable({ headers, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #ccc' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '5px 10px' }}>{cell ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AthleteReport() {
  const { selectedAthlete, setSelectedAthlete } = useDashboard()
  const navigate = useNavigate()

  const params = selectedAthlete ? { athlete_key: selectedAthlete, days: REPORT_DAYS } : null

  const { data: kpis,     isLoading: kpiLoading  } = useQuery({
    queryKey: ['report-kpis', params],
    queryFn:  () => dashboardApi.kpis(params),
    enabled:  !!params,
  })
  const { data: catSessions = [], isLoading: catLoading } = useQuery({
    queryKey: ['report-cat', params],
    queryFn:  () => catapultApi.sessions(params),
    enabled:  !!params,
  })
  const { data: recovery = [], isLoading: recLoading } = useQuery({
    queryKey: ['report-rec', params],
    queryFn:  () => whoopApi.recovery(params),
    enabled:  !!params,
  })
  const { data: workouts = [] } = useQuery({
    queryKey: ['report-workout', params],
    queryFn:  () => whoopApi.workout(params),
    enabled:  !!params,
  })
  const { data: acwrTrend = [] } = useQuery({
    queryKey: ['report-acwr', params],
    queryFn:  () => catapultApi.acwrTrend(params),
    enabled:  !!params,
  })

  // Derived values
  const athleteName    = catSessions[0]?.athlete_display_name
                      || recovery[0]?.athlete_display_name
                      || selectedAthlete || 'Unknown Athlete'
  const latestAcwrRow = acwrTrend[acwrTrend.length - 1]
  const acwrStatus    = latestAcwrRow?.acwr
    ? latestAcwrRow.acwr > 1.5 ? 'HIGH RISK' : latestAcwrRow.acwr > 1.4 ? 'CAUTION' : 'OPTIMAL'
    : '—'
  const acwrColor     = latestAcwrRow?.acwr
    ? latestAcwrRow.acwr > 1.5 ? '#c00' : latestAcwrRow.acwr > 1.4 ? '#b87000' : '#007a2f'
    : '#555'

  const isLoading = kpiLoading || catLoading || recLoading

  if (!selectedAthlete) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
          No athlete selected. Please select an athlete first.
        </p>
        <button className="toggle-btn active" onClick={() => navigate('/')}>← Back to Dashboard</button>
      </div>
    )
  }

  return (
    <>
      {/* ── Screen controls (hidden when printing) ── */}
      <div className="no-print" style={{
        display: 'flex', gap: '12px', alignItems: 'center',
        padding: '16px 24px', borderBottom: '1px solid var(--border)',
        background: 'rgba(0,0,0,0.3)',
      }}>
        <button className="toggle-btn" onClick={() => navigate(-1)}>← Back</button>
        <span style={{ color: 'var(--text-secondary)', fontSize: '13px', flex: 1 }}>
          Athlete Report — {athleteName} — last {REPORT_DAYS} days
        </span>
        <button
          className="toggle-btn active"
          onClick={() => window.print()}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          🖨 Print / Save PDF
        </button>
      </div>

      {/* ── Report body (white, print-friendly) ── */}
      <div id="report-body" style={{
        background: '#fff', color: '#111',
        maxWidth: '900px', margin: '24px auto',
        padding: '32px 40px',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        fontFamily: 'Arial, sans-serif',
      }}>
        {isLoading ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <LoadingSpinner message="Loading report data…" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', borderBottom: '3px solid #00843D', paddingBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#00843D', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Volleyball Performance Analytics
                </div>
                <h1 style={{ margin: '4px 0 2px', fontSize: '24px', fontWeight: 800, color: '#003d1e' }}>
                  {athleteName}
                </h1>
                <div style={{ fontSize: '13px', color: '#555' }}>
                  Performance Report — last {REPORT_DAYS} days
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#888' }}>Generated</div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>
                  {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>

            {/* KPI summary row */}
            <Section title="Key Performance Indicators">
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <StatBox label="Latest Player Load" value={kpis?.latest_player_load?.toFixed(0)} color="#00843D" />
                <StatBox label="Load / min" value={kpis?.latest_load_per_min?.toFixed(2)} color="#00843D" />
                <StatBox label="HRV (rMSSD)" value={kpis?.latest_hrv?.toFixed(0)} unit=" ms" color="#1565C0" />
                <StatBox label="Recovery Score" value={kpis?.latest_recovery?.toFixed(0)} unit="%" color="#6A1B9A" />
                <StatBox label={`ACWR (${acwrStatus})`} value={latestAcwrRow?.acwr?.toFixed(2)} color={acwrColor} />
                <StatBox label="Chronic Load" value={latestAcwrRow?.chronic_load?.toFixed(1)} unit=" AU/d" color="#555" />
              </div>
            </Section>

            {/* Training load table */}
            {catSessions.length > 0 && (
              <Section title="Training Load — Session Log">
                <ReportTable
                  headers={['Date', 'Activity', 'Player Load', 'Load/min', 'High Jumps', 'Distance (m)', 'Field Time']}
                  rows={catSessions.slice(0, 15).map(r => [
                    r.session_date || r.calendar_date,
                    r.activity_name,
                    r.total_player_load?.toFixed(0),
                    r.player_load_per_minute?.toFixed(2),
                    r.high_jump_count,
                    r.total_distance?.toFixed(0),
                    r.field_time ? `${r.field_time.toFixed(0)} min` : null,
                  ])}
                />
                {catSessions.length > 15 && (
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
                    Showing 15 of {catSessions.length} sessions.
                  </div>
                )}
              </Section>
            )}

            {/* WHOOP recovery table */}
            {recovery.length > 0 && (
              <Section title="WHOOP Recovery Log">
                <ReportTable
                  headers={['Date', 'HRV (ms)', 'Resting HR', 'Recovery %', 'Strain', 'SpO2', 'Skin Temp']}
                  rows={recovery.slice(0, 14).map(r => [
                    r.session_date || r.calendar_date,
                    r.hrv_rmssd_milli?.toFixed(0),
                    r.resting_heart_rate ? `${r.resting_heart_rate} bpm` : null,
                    r.recovery_score?.toFixed(0),
                    r.cycle_strain?.toFixed(1),
                    r.spo2_percentage ? `${r.spo2_percentage.toFixed(0)}%` : null,
                    r.skin_temp_celsius ? `${r.skin_temp_celsius.toFixed(1)}°C` : null,
                  ])}
                />
              </Section>
            )}

            {/* WHOOP workouts */}
            {workouts.length > 0 && (
              <Section title="WHOOP Workouts">
                <ReportTable
                  headers={['Date', 'Sport', 'Strain', 'Avg HR', 'Max HR', 'Duration', 'Calories']}
                  rows={workouts.slice(0, 10).map(r => [
                    r.session_date || r.calendar_date,
                    r.sport_name,
                    r.strain?.toFixed(1),
                    r.average_heart_rate ? `${r.average_heart_rate} bpm` : null,
                    r.max_heart_rate     ? `${r.max_heart_rate} bpm`     : null,
                    r.total_workout_hours ? `${r.total_workout_hours}h`  : null,
                    r.calories_kcal      ? `${r.calories_kcal} kcal`    : null,
                  ])}
                />
              </Section>
            )}

            {/* ACWR trend summary */}
            {acwrTrend.length > 0 && (
              <Section title="Workload Trend (ACWR)">
                <div style={{ marginBottom: '8px', fontSize: '12px', color: '#555' }}>
                  Green zone: 0.8 – 1.4 &nbsp;|&nbsp; Caution: 1.4 – 1.5 &nbsp;|&nbsp; High risk: &gt;1.5
                </div>
                <ReportTable
                  headers={['Date', 'Acute Load (AU/d)', 'Chronic Load (AU/d)', 'ACWR', 'Status']}
                  rows={[...acwrTrend].reverse().slice(0, 14).map(r => {
                    const status = r.acwr > 1.5 ? 'HIGH RISK' : r.acwr > 1.4 ? 'Caution' : r.acwr < 0.8 ? 'Low' : 'Optimal'
                    return [
                      r.session_date,
                      r.acute_load?.toFixed(1),
                      r.chronic_load?.toFixed(1),
                      r.acwr?.toFixed(2),
                      status,
                    ]
                  })}
                />
              </Section>
            )}

            {/* Footer */}
            <div style={{ marginTop: '32px', paddingTop: '12px', borderTop: '1px solid #ddd', fontSize: '10px', color: '#aaa', display: 'flex', justifyContent: 'space-between' }}>
              <span>Volleyball Performance Analytics — Confidential</span>
              <span>PBs reflect current dataset only, not all-time records.</span>
            </div>
          </>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          #report-body {
            box-shadow: none !important;
            margin: 0 !important;
            border-radius: 0 !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </>
  )
}

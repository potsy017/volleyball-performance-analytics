import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { dashboardApi, catapultApi, whoopApi } from "../services/api";
import LastSync from "../components/ui/LastSync";
import { downloadCsv } from "../utils/csvExport";
import { useDashboard } from "../context/DashboardContext";
import KPICard from "../components/ui/KPICard";
import PageHeader from "../components/ui/PageHeader";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ComboChart from "../components/charts/ComboChart";
import TrendLineChart from "../components/charts/TrendLineChart";
import DualAxisChart, {
  DUAL_METRICS,
} from "../components/charts/DualAxisChart";
import SelectDropdown from "../components/ui/SelectDropdown";
import DateRangePicker from "../components/ui/DateRangePicker";

const METRIC_TOGGLES = [
  { id: "player_load", label: "Player Load", color: "#4CAF50" },
  { id: "high_jumps", label: "High Jumps", color: "#C8E600" },
  { id: "hrv", label: "HRV", color: "#2196F3" },
  { id: "velocity", label: "Peak Velocity", color: "#F5C400" },
];

export default function MainDashboard() {
  const { selectedAthlete, setSelectedAthlete, days, setDays } = useDashboard();
  const [activeMetrics, setActiveMetrics] = useState([
    "player_load",
    "high_jumps",
    "hrv",
  ]);
  const [kpiMode, setKpiMode] = useState("latest"); // 'latest' | 'avg'
  const [primaryMetric, setPrimaryMetric] = useState("total_player_load");
  const [secondaryMetric, setSecondaryMetric] = useState("hrv_rmssd_milli");
  const [tertiaryMetric, setTertiaryMetric] = useState("chronic_load");
  const navigate = useNavigate();

  const params = {
    days,
    ...(selectedAthlete ? { athlete_key: selectedAthlete } : {}),
  };

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["kpis", params],
    queryFn: () => dashboardApi.kpis(params),
  });

  const { data: summary = [], isLoading: summaryLoading } = useQuery({
    queryKey: ["summary", params],
    queryFn: () => dashboardApi.summary(params),
  });

  const { data: teamSnapshot = [], isLoading: snapshotLoading } = useQuery({
    queryKey: ["team-snapshot"],
    queryFn: dashboardApi.teamSnapshot,
    enabled: !selectedAthlete,
  });

  // ACWR + chronic/acute load (for dual-axis options)
  const { data: acwrTrend = [] } = useQuery({
    queryKey: ["dash-acwr", params],
    queryFn: () => catapultApi.acwrTrend(params),
  });

  // Sleep data (for sleep performance % axis option)
  const { data: sleepData = [] } = useQuery({
    queryKey: ["dash-sleep", params],
    queryFn: () => whoopApi.sleep(params),
  });

  const catapultRows = summary.filter((r) => r.source === "catapult");
  const whoopRows = summary.filter((r) => r.source === "whoop");

  // Merge all sources by date for the dual-axis chart
  const mergedData = useMemo(() => {
    const map = {};

    // Catapult — player load, load/min, high jumps, total distance
    catapultRows.forEach((r) => {
      const d = r.session_date || r.calendar_date;
      if (!map[d]) map[d] = { session_date: d };
      map[d].total_player_load = r.total_player_load;
      map[d].player_load_per_minute = r.player_load_per_minute;
      map[d].high_jump_count = r.high_jump_count;
      map[d].total_distance = r.total_distance;
    });

    // WHOOP recovery — HRV, recovery score, resting HR, strain
    whoopRows.forEach((r) => {
      const d = r.session_date || r.calendar_date;
      if (!map[d]) map[d] = { session_date: d };
      map[d].hrv_rmssd_milli = r.hrv_rmssd_milli;
      map[d].recovery_score = r.recovery_score;
      map[d].resting_heart_rate = r.resting_heart_rate;
      map[d].cycle_strain = r.cycle_strain;
    });

    // ACWR trend — acute load, chronic load, ACWR ratio
    acwrTrend.forEach((r) => {
      const d = r.session_date;
      if (!map[d]) map[d] = { session_date: d };
      map[d].acwr = r.acwr;
      map[d].acute_load = r.acute_load;
      map[d].chronic_load = r.chronic_load;
    });

    // WHOOP sleep — sleep performance %
    sleepData.forEach((r) => {
      const d = r.session_date || r.calendar_date;
      if (!map[d]) map[d] = { session_date: d };
      map[d].sleep_performance_percentage = r.sleep_performance_percentage;
    });

    return Object.values(map).sort((a, b) =>
      a.session_date < b.session_date ? -1 : 1,
    );
  }, [summary, acwrTrend, sleepData]);

  // Metric options for dropdowns (exclude whichever is selected on the other axis)
  const metricOptions = DUAL_METRICS.map((m) => ({
    value: m.key,
    label: m.label,
  }));
  const primaryOptions = metricOptions.filter(
    (o) => o.value !== secondaryMetric && o.value !== tertiaryMetric,
  );
  const secondaryOptions = [
    { value: "", label: "None" },
    ...metricOptions.filter(
      (o) => o.value !== primaryMetric && o.value !== tertiaryMetric,
    ),
  ];
  const tertiaryOptions = [
    { value: "", label: "None" },
    ...metricOptions.filter(
      (o) => o.value !== primaryMetric && o.value !== secondaryMetric,
    ),
  ];

  const pm = DUAL_METRICS.find((m) => m.key === primaryMetric);
  const sm = DUAL_METRICS.find((m) => m.key === secondaryMetric);
  const tm = DUAL_METRICS.find((m) => m.key === tertiaryMetric);

  const toggleMetric = (id) => {
    setActiveMetrics((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const recoveryStatus = (score) => {
    if (score == null) return { label: "No data", cls: "badge-gray" };
    if (score >= 67) return { label: "Good", cls: "badge-green" };
    if (score >= 34) return { label: "Monitor", cls: "badge-amber" };
    return { label: "Low", cls: "badge-red" };
  };

  const acwrBadge = (status, value) => {
    const cls =
      {
        green: "badge-green",
        amber: "badge-amber",
        red: "badge-red",
        gray: "badge-gray",
      }[status] || "badge-gray";
    return { cls, label: value != null ? value.toFixed(2) : "—" };
  };

  return (
    <div
      className="page-enter"
      style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}
    >
      <PageHeader
        title="Main Dashboard"
        subtitle="Explore & overlay metrics across all sources"
      >
        {selectedAthlete && (
          <button
            className="toggle-btn"
            onClick={() => navigate("/report")}
            style={{ display: "flex", alignItems: "center", gap: "5px" }}
          >
            🖨 Report
          </button>
        )}
        {/* Latest / Avg toggle — always visible */}
        <div className="toggle-group">
          {["latest", "avg"].map((mode) => (
            <button
              key={mode}
              className={`toggle-btn ${kpiMode === mode ? "active" : ""}`}
              onClick={() => setKpiMode(mode)}
            >
              {mode === "latest" ? "Latest" : `${days}d Avg`}
            </button>
          ))}
        </div>
        <DateRangePicker days={days} onChange={setDays} />
      </PageHeader>

      {/* Metric toggles */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        {METRIC_TOGGLES.map((m) => (
          <button
            key={m.id}
            onClick={() => toggleMetric(m.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "20px",
              border: activeMetrics.includes(m.id)
                ? `1px solid ${m.color}40`
                : "1px solid var(--border)",
              background: activeMetrics.includes(m.id)
                ? `${m.color}15`
                : "transparent",
              color: activeMetrics.includes(m.id)
                ? m.color
                : "var(--text-secondary)",
              fontSize: "12px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: activeMetrics.includes(m.id)
                  ? m.color
                  : "var(--text-muted)",
              }}
            />
            {m.label}
          </button>
        ))}
      </div>

      {/* KPI Row */}
      {kpisLoading ? (
        <LoadingSpinner message="Loading metrics..." />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          {selectedAthlete && kpiMode === "latest" ? (
            /* Individual athlete — LATEST SESSION */
            <>
              <KPICard
                label="Player Load"
                value={kpis?.latest_player_load}
                decimals={0}
                sub={
                  kpis?.latest_session_date
                    ? `latest · ${kpis.latest_session_date}`
                    : "latest session"
                }
              />
              <KPICard
                label="Load / min"
                value={kpis?.latest_load_per_min}
                decimals={2}
                sub="latest session"
                color="#C8E600"
              />
              <KPICard
                label="High Jumps"
                value={kpis?.latest_high_jumps}
                decimals={0}
                sub="latest session"
                color="#F5C400"
              />
              <KPICard
                label="HRV (rMSSD)"
                value={kpis?.latest_hrv}
                unit="ms"
                decimals={0}
                sub={
                  kpis?.latest_recovery_date
                    ? `latest · ${kpis.latest_recovery_date}`
                    : "latest"
                }
                color="#2196F3"
              />
              <KPICard
                label="Recovery"
                value={kpis?.latest_recovery}
                unit="%"
                decimals={0}
                sub="latest score"
                color={
                  kpis?.latest_recovery >= 67
                    ? "#4CAF50"
                    : kpis?.latest_recovery >= 34
                      ? "#F5C400"
                      : "#F44336"
                }
              />
              <KPICard
                label="Sessions"
                value={kpis?.sessions_count}
                decimals={0}
                sub={`last ${days} days`}
                color="var(--text-secondary)"
              />
            </>
          ) : selectedAthlete && kpiMode === "avg" ? (
            /* Individual athlete — PERIOD AVERAGES */
            <>
              <KPICard
                label="Avg Load / min"
                value={kpis?.avg_player_load_per_min}
                decimals={2}
                sub={`${days}-day avg`}
              />
              <KPICard
                label="Avg High Jumps"
                value={kpis?.avg_high_jumps}
                decimals={0}
                sub={`${days}-day avg`}
                color="#F5C400"
              />
              <KPICard
                label="Avg HRV"
                value={kpis?.avg_hrv}
                unit="ms"
                decimals={0}
                sub={`${days}-day avg`}
                color="#2196F3"
              />
              <KPICard
                label="Avg Recovery"
                value={kpis?.avg_recovery}
                unit="%"
                decimals={0}
                sub={`${days}-day avg`}
                color={
                  kpis?.avg_recovery >= 67
                    ? "#4CAF50"
                    : kpis?.avg_recovery >= 34
                      ? "#F5C400"
                      : "#F44336"
                }
              />
              <KPICard
                label="Avg Resting HR"
                value={kpis?.avg_resting_hr}
                unit="bpm"
                decimals={0}
                sub={`${days}-day avg`}
                color="#F44336"
              />
              <KPICard
                label="Sessions"
                value={kpis?.sessions_count}
                decimals={0}
                sub={`last ${days} days`}
                color="var(--text-secondary)"
              />
            </>
          ) : kpiMode === "latest" ? (
            /* All athletes — TEAM LATEST */
            <>
              <KPICard
                label="Player Load"
                value={kpis?.latest_player_load}
                decimals={0}
                sub={
                  kpis?.latest_session_date
                    ? `latest · ${kpis.latest_session_date}`
                    : "latest session"
                }
              />
              <KPICard
                label="Load / min"
                value={kpis?.latest_load_per_min}
                decimals={2}
                sub="latest session"
                color="#C8E600"
              />
              <KPICard
                label="High Jumps"
                value={kpis?.latest_high_jumps}
                decimals={0}
                sub="latest session"
                color="#F5C400"
              />
              <KPICard
                label="HRV (rMSSD)"
                value={kpis?.latest_hrv}
                unit="ms"
                decimals={0}
                sub={
                  kpis?.latest_recovery_date
                    ? `latest · ${kpis.latest_recovery_date}`
                    : "latest"
                }
                color="#2196F3"
              />
              <KPICard
                label="Recovery"
                value={kpis?.latest_recovery}
                unit="%"
                decimals={0}
                sub="latest score"
                color={
                  kpis?.latest_recovery >= 67
                    ? "#4CAF50"
                    : kpis?.latest_recovery >= 34
                      ? "#F5C400"
                      : "#F44336"
                }
              />
              <KPICard
                label="Sessions"
                value={kpis?.sessions_count}
                decimals={0}
                sub={`last ${days} days`}
                color="var(--text-secondary)"
              />
            </>
          ) : (
            /* All athletes — TEAM AVERAGES */
            <>
              <KPICard
                label="Load / min"
                value={kpis?.avg_player_load_per_min}
                decimals={2}
                sub={`${days}-day avg`}
              />
              <KPICard
                label="High Jumps"
                value={kpis?.avg_high_jumps}
                decimals={0}
                sub="avg per session"
                color="#C8E600"
              />
              <KPICard
                label="HRV (rMSSD)"
                value={kpis?.avg_hrv}
                unit="ms"
                decimals={0}
                sub="team avg"
                color="#2196F3"
              />
              <KPICard
                label="Recovery"
                value={kpis?.avg_recovery}
                unit="%"
                decimals={0}
                sub="team avg"
                color={kpis?.avg_recovery >= 67 ? "#4CAF50" : "#F5C400"}
              />
              <KPICard
                label="Sessions"
                value={kpis?.sessions_count}
                decimals={0}
                sub={`last ${days} days`}
                color="var(--text-secondary)"
              />
            </>
          )}
        </div>
      )}

      {/* Charts */}
      {summaryLoading ? (
        <LoadingSpinner message="Loading charts..." />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          {activeMetrics.includes("player_load") && (
            <div className="card" style={{ gridColumn: "1 / -1" }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  marginBottom: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Training Load</span>
                <span
                  style={{ fontSize: "11px", color: "var(--text-secondary)" }}
                >
                  bars = player load · line = load/min
                </span>
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

          {activeMetrics.includes("high_jumps") && (
            <div
              className="card"
              onClick={() => navigate("/catapult")}
              style={{ cursor: "pointer" }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  marginBottom: "16px",
                }}
              >
                High Jump Count
              </div>
              <TrendLineChart
                data={catapultRows}
                lines={[
                  {
                    key: "high_jump_count",
                    name: "High Jumps",
                    color: "#C8E600",
                  },
                ]}
                height={200}
              />
            </div>
          )}

          {activeMetrics.includes("hrv") && (
            <div
              className="card"
              onClick={() => navigate("/whoop")}
              style={{ cursor: "pointer" }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  marginBottom: "16px",
                }}
              >
                HRV + Resting HR
              </div>
              <TrendLineChart
                data={whoopRows}
                lines={[
                  {
                    key: "hrv_rmssd_milli",
                    name: "HRV (ms)",
                    color: "#2196F3",
                  },
                  {
                    key: "resting_heart_rate",
                    name: "Resting HR",
                    color: "#F44336",
                    dashed: true,
                  },
                ]}
                height={200}
              />
            </div>
          )}

          {activeMetrics.includes("velocity") && (
            <div
              className="card"
              onClick={() => navigate("/gymaware")}
              style={{ cursor: "pointer" }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  marginBottom: "16px",
                }}
              >
                Peak Velocity Trend
              </div>
              <TrendLineChart
                data={summary.filter((r) => r.source === "gymaware")}
                lines={[
                  {
                    key: "peak_velocity",
                    name: "Peak Velocity",
                    color: "#F5C400",
                  },
                ]}
                height={200}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Dual-Axis Configurable Chart ── */}
      {!summaryLoading && (
        <div className="card" style={{ marginBottom: "20px" }}>
          {/* Header row with dropdowns */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  whiteSpace: "nowrap",
                }}
              >
                Primary:
              </span>
              <SelectDropdown
                options={primaryOptions}
                value={primaryMetric}
                onChange={setPrimaryMetric}
                minWidth={160}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  whiteSpace: "nowrap",
                }}
              >
                Secondary:
              </span>
              <SelectDropdown
                options={secondaryOptions}
                value={secondaryMetric}
                onChange={setSecondaryMetric}
                minWidth={160}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  whiteSpace: "nowrap",
                }}
              >
                Tertiary:
              </span>
              <SelectDropdown
                options={tertiaryOptions}
                value={tertiaryMetric}
                onChange={setTertiaryMetric}
                minWidth={160}
              />
            </div>
          </div>
          {/* Dynamic title */}
          <div style={{ marginBottom: "4px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600 }}>
              {pm?.label}
              {sm ? ` vs ${sm.label}` : ""}
              {tm ? ` vs ${tm.label}` : ""}
            </span>
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-secondary)",
              marginBottom: "16px",
            }}
          >
            Overlay metrics to identify correlations and trends.
            {pm && <span style={{ color: pm.color }}> Left: {pm.label}. </span>}
            {sm && <span style={{ color: sm.color }}>Right: {sm.label}. </span>}
            {tm && (
              <span style={{ color: tm.color }}>
                Right (scaled): {tm.label} - dashed line normalised to right
                axis.
              </span>
            )}
          </div>

          <DualAxisChart
            data={mergedData}
            primaryKey={primaryMetric}
            secondaryKey={secondaryMetric || null}
            tertiaryKey={tertiaryMetric || null}
            height={300}
          />
        </div>
      )}

      {/* Team snapshot */}
      {!selectedAthlete && (
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 500 }}>
              Team snapshot — latest data per athlete
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <LastSync data={summary} />
              <button
                className="toggle-btn"
                onClick={() =>
                  downloadCsv(teamSnapshot, "team-snapshot.csv", [
                    "athlete_name",
                    "last_session",
                    "player_load",
                    "load_per_min",
                    "high_jumps",
                    "hrv",
                    "recovery",
                    "acwr",
                    "acute_load",
                    "chronic_load",
                    "acwr_status",
                  ])
                }
              >
                ⬇ Export CSV
              </button>
            </div>
          </div>
          {snapshotLoading ? (
            <LoadingSpinner />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="vpa-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Athlete</th>
                    <th>Last Session</th>
                    <th>Player Load</th>
                    <th>Load/min</th>
                    <th>High Jumps</th>
                    <th>HRV</th>
                    <th>Recovery</th>
                    <th title="Acute:Chronic Workload Ratio (7d÷28d avg load)">
                      ACWR
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {teamSnapshot.map((a) => {
                    const status = recoveryStatus(a.recovery);
                    const acwr = acwrBadge(a.acwr_status, a.acwr);
                    return (
                      <tr
                        key={a.athlete_internal_key}
                        style={{ cursor: "pointer" }}
                        onClick={() =>
                          setSelectedAthlete(a.athlete_internal_key)
                        }
                        title={`Click to filter by ${a.athlete_name}`}
                      >
                        <td style={{ color: "var(--text-muted)" }}>
                          {a.jersey || "—"}
                        </td>
                        <td style={{ fontWeight: 500 }}>{a.athlete_name}</td>
                        <td style={{ color: "var(--text-secondary)" }}>
                          {a.last_session || "—"}
                        </td>
                        <td>{a.player_load?.toFixed(0) ?? "—"}</td>
                        <td>{a.load_per_min?.toFixed(2) ?? "—"}</td>
                        <td>{a.high_jumps ?? "—"}</td>
                        <td>{a.hrv ? `${a.hrv.toFixed(0)} ms` : "—"}</td>
                        <td>
                          <span className={`badge ${status.cls}`}>
                            {status.label}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${acwr.cls}`}>
                            {acwr.label}
                          </span>
                          {a.acwr_status !== "gray" && a.acute_load != null && (
                            <span
                              style={{
                                fontSize: "10px",
                                color: "var(--text-muted)",
                                marginLeft: "4px",
                              }}
                            >
                              ({a.acute_load}/{a.chronic_load})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

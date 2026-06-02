// frontend/src/components/charts/DualAxisChart.jsx
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";

export const DUAL_METRICS = [
  {
    key: "total_player_load",
    label: "Player Load",
    color: "#4CAF50",
    unit: "AU",
  },
  {
    key: "player_load_per_minute",
    label: "Load / min",
    color: "#C8E600",
    unit: "AU/min",
  },
  { key: "high_jump_count", label: "High Jumps", color: "#F5C400", unit: "" },
  {
    key: "hrv_rmssd_milli",
    label: "HRV (rMSSD)",
    color: "#2196F3",
    unit: "ms",
  },
  {
    key: "recovery_score",
    label: "Recovery Score",
    color: "#00BCD4",
    unit: "%",
  },
  {
    key: "resting_heart_rate",
    label: "Resting HR",
    color: "#F44336",
    unit: "bpm",
  },
  { key: "cycle_strain", label: "Strain", color: "#FF9800", unit: "" },
  { key: "chronic_load", label: "Chronic Load", color: "#9C27B0", unit: "AU" },
  { key: "acute_load", label: "Acute Load", color: "#E91E63", unit: "AU" },
  { key: "acwr", label: "ACWR", color: "#FF5722", unit: "" },
  {
    key: "sleep_performance_percentage",
    label: "Sleep %",
    color: "#3F51B5",
    unit: "%",
  },
  {
    key: "total_distance",
    label: "Total Distance",
    color: "#607D8B",
    unit: "m",
  },
];

// Normalise a value from its original range to a target range
function normalise(value, min, max, targetMin = 0, targetMax = 100) {
  if (max === min) return targetMin;
  return ((value - min) / (max - min)) * (targetMax - targetMin) + targetMin;
}

const CustomTooltip = ({ active, payload, label, metrics }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#1A1D24",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "8px",
        padding: "10px 14px",
        fontSize: "12px",
      }}
    >
      <p style={{ color: "var(--text-secondary)", margin: "0 0 6px" }}>
        {label}
      </p>
      {payload.map((p, i) => {
        // find original value for normalised series
        const meta = metrics?.find((m) => m.normKey === p.dataKey);
        const displayVal = meta ? p.payload[meta.origKey] : p.value;
        return (
          <p
            key={i}
            style={{ color: p.color, margin: "2px 0", fontWeight: 500 }}
          >
            {p.name}:{" "}
            {typeof displayVal === "number"
              ? displayVal.toFixed(2)
              : (displayVal ?? "—")}
          </p>
        );
      })}
    </div>
  );
};

export default function DualAxisChart({
  data = [],
  primaryKey,
  secondaryKey,
  tertiaryKey = null, // ← new third axis
  height = 300,
}) {
  const pm = DUAL_METRICS.find((m) => m.key === primaryKey);
  const sm = DUAL_METRICS.find((m) => m.key === secondaryKey);
  const tm = DUAL_METRICS.find((m) => m.key === tertiaryKey);

  // Normalise tertiary metric to secondary axis scale so it shares the right axis
  // but tooltip shows real values
  const normKey = tertiaryKey ? `__norm_${tertiaryKey}` : null;

  const enrichedData = useMemo(() => {
    if (!tertiaryKey || !data.length) return data;

    const vals = data.map((d) => d[tertiaryKey]).filter((v) => v != null);
    if (!vals.length) return data;

    const tMin = Math.min(...vals);
    const tMax = Math.max(...vals);

    // Get secondary axis range for normalisation target
    const sVals = data.map((d) => d[secondaryKey]).filter((v) => v != null);
    const sMin = sVals.length ? Math.min(...sVals) : 0;
    const sMax = sVals.length ? Math.max(...sVals) : 100;

    return data.map((d) => ({
      ...d,
      [normKey]:
        d[tertiaryKey] != null
          ? normalise(d[tertiaryKey], tMin, tMax, sMin, sMax)
          : null,
    }));
  }, [data, tertiaryKey, secondaryKey, normKey]);

  const tooltipMetrics = tm ? [{ normKey, origKey: tertiaryKey }] : [];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={enrichedData}
        margin={{ top: 4, right: 48, bottom: 0, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="session_date"
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => (v ? String(v).slice(5) : "")}
        />
        {/* Left axis — primary */}
        <YAxis
          yAxisId="left"
          tick={{ fill: pm?.color ?? "var(--text-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        {/* Right axis — secondary (and normalised tertiary shares this) */}
        {sm && secondaryKey && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: sm?.color ?? "var(--text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
        )}
        <Tooltip content={<CustomTooltip metrics={tooltipMetrics} />} />
        <Legend
          wrapperStyle={{
            fontSize: "12px",
            color: "var(--text-secondary)",
            paddingTop: "12px",
          }}
        />
        {/* Primary — Bar */}

        {pm && (
          <Bar
            yAxisId="left"
            dataKey={primaryKey}
            name={pm.label}
            fill={pm.color}
            radius={[3, 3, 0, 0]}
            fillOpacity={0.8}
          />
        )}
        {/* Secondary — only render if secondaryKey exists */}
        {sm && secondaryKey && (
          <Line
            yAxisId="right"
            dataKey={secondaryKey}
            name={sm.label}
            stroke={sm.color}
            strokeWidth={2.5}
            dot={{ r: 3, fill: sm.color, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: sm.color }}
            connectNulls
          />
        )}
        {/* Tertiary — only render if both tertiaryKey and secondaryKey exist */}
        {tm && normKey && secondaryKey && (
          <Line
            yAxisId="right"
            dataKey={normKey}
            name={`${tm.label} (scaled)`}
            stroke={tm.color}
            strokeDasharray="5 4"
            strokeWidth={2.5}
            dot={{ r: 3, fill: tm.color, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: tm.color }}
            connectNulls
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

# VPA charts reference

All time-series charts use **`connectNulls`** (via `frontend/src/components/charts/chartDefaults.js` → `CHART_CONTINUITY`) so gaps in the calendar do not break line continuity. Scatter plots (efficiency sessions, load–velocity points) stay as discrete markers by design.

**Jump metrics (BMP):** High jumps and **total jumps** come from `silver_catapult_jump_session`, aggregated per `calendar_date` in `backend/app/utils/jump_metrics.py` and attached to Catapult session rows as `high_jump_count`, `total_jumps`, and `session_jump_count`.

---

## Main dashboard (`/`)

Requires a selected athlete for athlete-specific panels; team view shows KPIs and team snapshot without those panels.

### Athlete-only visualizations

| Chart | Component | API | Window | Data / notes |
|-------|-----------|-----|--------|----------------|
| **Performance radar** | `AthleteRadarChart` | `GET /api/dashboard/radar-metrics?athlete_key=&days=30` | 30d baseline | Fixed **pentagon (5)** or **heptagon (7)** with WHOOP. Axes: Explosive Power (GymAware peak velocity vs 30d avg), **Volume** (BMP daily `jump_event_count` vs 30d max), **Intensity** (BMP `high_jump_event_count` vs 30d max), Fitness/Engine (load/min), ACWR Safety; + Recovery & Sleep Eff when WHOOP exists. Empty spokes plot at centre (0); dots only on populated axes. |
| **Triad — injury risk** | `TriadRiskCharts` | `GET /api/dashboard/triad-risk?athlete_key=&days=14&baseline_days=30` | 14d display, 30d thresholds | Three synced area charts: **ACWR** (red &gt; 1.5), **WHOOP deep sleep** (slow-wave hours; red below 30d minimum; needs WHOOP), **neuromuscular** — Catapult **max jump height** vs 30d ceiling (red below 90% of ceiling), or **high-band jump ratio** fallback when &lt;3 height days in baseline. Critical day when all three are red (sleep leg requires WHOOP). |
| **Internal vs external efficiency** | `EfficiencyScatterChart` | `GET /api/dashboard/efficiency-scatter?athlete_key=&days=30&recent_days=3` | 30d | X = Catapult `total_player_load` per session; Y = WHOOP `cycle_strain` (SCORED recovery). Purple dashed line = 30d efficiency trendline; solid blue = last 3 days. **Requires same-day Catapult + WHOOP** — empty chart is expected for athletes without WHOOP. |

### Shared dashboard charts

| Chart | Component | API / source | Notes |
|-------|-----------|--------------|--------|
| **Training load** | `ComboChart` | `GET /api/dashboard/summary` (catapult) | Bars = player load; line = load/min |
| **Daily total jumps** | `TrendLineChart` | `GET /api/dashboard/daily-jumps?athlete_key=&days=` | Dense date spine; BMP `total_jumps` per day |
| **High jump count** | `TrendLineChart` | `daily-jumps` or summary | BMP `high_jump_count` per day |
| **HRV + resting HR** | `TrendLineChart` | summary (whoop) | SCORED recovery preferred |
| **Peak velocity** | `TrendLineChart` | summary (gymaware) | When GymAware data exists |
| **Multi-metric overlay** | `DualAxisChart` | Merged: summary + `GET /api/catapult/acwr-trend` + `GET /api/whoop/sleep` | Up to 3 metrics; includes **Total Jumps**, High Jumps, ACWR, load, HRV, strain, sleep %, etc. |
| **Team snapshot** | table | `GET /api/dashboard/team-snapshot` | Per-athlete latest load, **high jumps**, **total jumps**, HRV, recovery, ACWR |

### KPIs

`GET /api/dashboard/kpis` — includes `latest_total_jumps`, `avg_total_jumps`, `latest_high_jumps`, `avg_high_jumps` (BMP daily aggregates), plus load and WHOOP fields.

---

## Catapult (`/catapult`)

| Chart | Component | API |
|-------|-----------|-----|
| Load combo | `ComboChart` | `GET /api/catapult/sessions` (BMP fields attached) |
| ACWR trend | `TrendLineChart` | `GET /api/catapult/acwr-trend` |
| High jumps | `TrendLineChart` | sessions / load-trend |
| Distance | `TrendLineChart` | sessions |

Session detail KPIs use BMP **`session_jump_count`** / **`total_jumps`** for total jumps and **`high_jump_count`** for high jumps.

---

## GymAware (`/gymaware`)

| Chart | Component | API |
|-------|-----------|-----|
| Velocity trend | `TrendLineChart` | `GET /api/gymaware/velocity-trend` |
| V–L scatter + regression | `VLScatterChart` | `GET /api/gymaware/vl-profile` |
| Lmax / Vmax progress | `LoadVelocityProgressChart` | `GET /api/gymaware/load-velocity-analysis` |
| Multi-session load–velocity | `LoadVelocityMultiProfileChart` | same |

---

## WHOOP (`/whoop`)

| Chart | Component | API |
|-------|-----------|-----|
| Recovery / HRV / strain trends | `TrendLineChart` | `GET /api/whoop/recovery`, `/hrv-trend`, etc. |
| Sleep metrics | `TrendLineChart` | `GET /api/whoop/sleep` |

Triad deep sleep uses `silver_whoop_sleep_longest_per_day.total_slow_wave_sleep_time_milli` (not the sleep breakdown page alone).

---

## Chart components (frontend)

| File | Used on |
|------|---------|
| `TrendLineChart.jsx` | Main dashboard, Catapult, GymAware, Whoop |
| `ComboChart.jsx` | Main dashboard, Catapult |
| `DualAxisChart.jsx` | Main dashboard |
| `AthleteRadarChart.jsx` | Main dashboard (athlete) |
| `TriadRiskCharts.jsx` | Main dashboard (athlete) |
| `EfficiencyScatterChart.jsx` | Main dashboard (athlete) |
| `LoadVelocityProgressChart.jsx` | GymAware |
| `LoadVelocityMultiProfileChart.jsx` | GymAware |
| `VLScatterChart.jsx` | GymAware |
| `chartDefaults.js` | Shared `connectNulls` for all series above |

---

## Troubleshooting empty charts

| Symptom | Likely cause |
|---------|----------------|
| No total/high jumps | BMP ETL not run or `silver_catapult_jump_session` empty for athlete |
| Radar Volume/Intensity flat at centre | No BMP rows in 30d window |
| Triad bottom panel empty | No `max_jump_height_cm` and insufficient rows for ratio fallback |
| Triad middle panel empty | No WHOOP sleep silver for athlete |
| Efficiency scatter empty | No WHOOP `cycle_strain` on same dates as Catapult sessions |
| Line drops to zero on missing days | Ensure frontend rebuilt after `CHART_CONTINUITY`; backend should return `null` for missing days on dense spines (`daily-jumps`, `acwr-trend`, triad `series`) |

Verify ETL and roster: toolkit `docs/operations/vpa_frontend_integration.md` and `docs/volley-etl/catapult_bmp_jumps_handover.md`.

---

## Planned (not implemented)

Future visualizations and feasibility notes (including the **Readiness vs. Reality Discrepancy Matrix**) are documented in **[PLANNED_FEATURES.md](PLANNED_FEATURES.md)** for client planning only — not in the current build.

# Final Business Pitch — Technical Handover Brief

**Audience:** Engineering team speaker notes · Client handover  
**Scope:** `Capstone-team54-volleyball-toolkit` (ETL/schema) · `vpa/Volleyball_Performance_Analysis` (app) · `Beach-Volleyball-Data-Analysis-Web-Dashboard` (portfolio bundle; ETL/UI copies of the above)  
**Supabase project:** PostgREST + Postgres silver views · **no RLS deployed yet** (roadmap §4)

> **Handover operations:** Monorepo migration, Railway services, WHOOP cutover, and checklists → [`COMPLETE_HANDOVER_PLAN.md`](./COMPLETE_HANDOVER_PLAN.md).

---

## 1. Architectural Map & Data Pipeline

### 1.1 Medallion flow

```text
Vendor APIs (Catapult / WHOOP / GymAware / VALD)
        ↓
Bronze staging + *_bi_extract tables (append-only, flat columns)
        ↓
Silver views (dedupe, roster keys, calendar_date)
        ↓
FastAPI BFF (service role) → React (TanStack Query + Recharts)
```

**Join keys (all silver):** `athlete_internal_key` (`VB-{gymaware_ref}`) + `calendar_date`  
**Roster source:** `data/roster/roster_new.xlsx` → `roster_cohort` + `athlete_identity` (not a SQL table named `roster_new`)

**Schema DDL:** `Capstone-team54-volleyball-toolkit/schema/` · apply order: `schema/apply_order.txt`

---

### 1.2 Roster (`roster_new.xlsx` → SQL)

| Object | File | Grain / purpose |
|--------|------|-----------------|
| Workbook | `data/roster/roster_new.xlsx` | Coach-editable allowlist (GymAware sheet: names, GymAware ID, VALD ID, Catapult jersey, WHOOP user ID) |
| `public.roster_cohort` | `schema/roster_cohort.sql` | PK `gymaware_athlete_reference`; `vald_profile_id`, `display_label`, `catapult_jersey` |
| `public.athlete_identity` | `schema/athlete_identity.sql` | PK `internal_key`; maps Catapult UUID, GymAware ref, VALD, WHOOP |

Sync: `scripts/sync_roster_cohort_from_xlsx.py`, `sync_athlete_identity_from_xlsx.py` (runs inside `scheduled_etl.py` unless `SCHEDULED_SKIP_ROSTER_SYNC=1`).

---

### 1.3 Bronze BI extract tables (requested definitions)

#### `public.catapult_stats_bi_extract`
**File:** `schema/catapult_stats_bi_extract.sql`  
**Grain:** One row per stats period ingest (`activity_id`, `athlete_key`, `period_name`, …)

| Group | Key columns |
|-------|-------------|
| Grain / lineage | `activity_id`, `athlete_id`, `athlete_key`, `source_staging_ingest_id`, `participating_athlete_id` |
| Context | `athlete_jersey`, `team_name`, `activity_name`, `period_name`, `stats_date` |
| Load / distance | `total_player_load`, `player_load_per_minute`, `peak_player_load`, **`total_distance`** |
| Jumps (legacy stats) | `total_jumps`, `indoor_analytics_total_jump_count`, `ima_band1_jump_count` … `ima_band8_jump_count` |
| HR / velocity | `max_vel`, `athlete_max_velocity`, `max_heart_rate`, … |
| Audit | `etl_ingested_at`, `id` |

**Silver consumer:** `silver_catapult_session` (session-level SUM/MAX + BMP left join).

#### `public.whoop_recovery_bi_extract`
**File:** `schema/whoop_bi_extract.sql` (lines 220–238)  
**Grain:** `(whoop_user_id, cycle_id)`

| Column | Role |
|--------|------|
| `recovery_score` | Primary recovery % |
| `hrv_rmssd_milli`, `resting_heart_rate` | Autonomic markers |
| `score_state` | Prefer `SCORED` in silver |
| `sleep_id`, `cycle_id`, `whoop_user_id` | Lineage / join |

**Silver consumer:** `silver_whoop_recovery` (+ cycle fields joined from `whoop_cycle_bi_extract`).

#### `public.gymaware_summaries_bi_extract`
**File:** `schema/gymaware_extended.sql` (lines 66–106)  
**Grain:** One row per GymAware set (`gymaware_reference` UNIQUE)

| Column | Role |
|--------|------|
| `athlete_reference`, `athlete_name` | Athlete grain |
| `exercise_name`, `bar_weight`, `rep_count` | Set context |
| **`peak_velocity`**, `mean_velocity` | Radar **Explosive Power** |
| `peak_power`, `mean_power` | Power metrics |
| `recorded`, `modified` | Timestamps (Unix) |

**Silver consumer:** `silver_gymaware_summaries` (dedupe on `gymaware_reference`, adds `calendar_date`, `athlete_internal_key`).

---

### 1.4 Silver views (app read surface)

| Silver view | Bronze / staging source | Dedup rule |
|-------------|-------------------------|------------|
| `silver_catapult_session` | `catapult_stats_bi_extract` + BMP join | `(activity_id, session_athlete_grain)` |
| `silver_catapult_jump_session` | `catapult_jump_events_session` | `(activity_id, athlete_id)` latest ingest |
| `silver_whoop_recovery` | `whoop_recovery_bi_extract` | `(whoop_user_id, cycle_id)` prefer SCORED |
| `silver_whoop_sleep_longest_per_day` | `silver_whoop_sleep` | Longest sleep per user-day |
| `silver_gymaware_summaries` | `gymaware_summaries_bi_extract` | `gymaware_reference` |

All silver views: `WITH (security_invoker = true)` — caller privileges apply; **not a substitute for RLS**.

---

### 1.5 Frontend data access (no direct silver queries in React)

**Pattern:** Browser → Axios `/api/*` → FastAPI `get_client()` → **httpx PostgREST** (`backend/app/db/supabase.py`) with **`SUPABASE_SERVICE_KEY`**.

**Exception:** `@supabase/supabase-js` in frontend is **auth only** (`profiles.role` lookup); dashboard metrics do **not** use Supabase JS against silver tables.

| API route | Silver tables queried | Join logic |
|-----------|----------------------|------------|
| `GET /dashboard/radar-metrics` | `silver_catapult_session`, `silver_catapult_jump_session`, `silver_gymaware_summaries`, `silver_whoop_recovery`, `silver_whoop_sleep_longest_per_day` | Per-athlete filter `eq(athlete_internal_key)`; BMP daily sums via `jump_metrics.py` |
| `GET /dashboard/triad-risk` | `silver_catapult_session`, `silver_catapult_jump_session`, `silver_whoop_sleep_longest_per_day` | Dense `date_spine`; ACWR computed in Python |
| `GET /dashboard/efficiency-scatter` | `silver_catapult_session`, `silver_whoop_recovery` | Same-day join on `calendar_date` |
| `GET /dashboard/team-snapshot` | Catapult + jump + WHOOP recovery | Latest per athlete |
| `GET /dashboard/kpis`, `/summary`, `/daily-jumps` | Catapult, jump, gym, WHOOP | Windowed `gte(calendar_date, since)` |

**No RPC functions** — all reads are PostgREST table/view `select` with filters.

**Frontend client:** `frontend/src/services/api.js` → `dashboardApi.radarMetrics`, `triadRisk`, `efficiencyScatter`.

---

## 2. Core Logic & Algorithms

### 2.1 ACWR (Acute-to-Chronic Workload Ratio)

**File:** `vpa/.../backend/app/utils/acwr.py` · **`compute_acwr()`**

```text
daily_load[d] = SUM(total_player_load) for all sessions on calendar_date d

acute_load  = (Σ daily_load over ref day and prior 6 days) / 7
chronic_load = (Σ daily_load over ref day and prior 27 days) / 28

ACWR = round(acute_load / chronic_load, 2)   if chronic_load > 0 else null
has_acwr = any session date in chronic window
```

**Status bands** (`dashboard.py::_acwr_status`): green 0.8–1.4 · amber >1.4 or <0.8 · red >1.5 or <0.5 · gray null.

**Used by:** Triad panel 1 · Radar ACWR Safety · team snapshot · Readiness · Catapult ACWR trend.

---

### 2.2 Radar normalization (0–100 for Recharts)

**Files:** `frontend/src/utils/formatRadarData.js` · `backend/app/routers/dashboard.py` (`get_radar_metrics`)

| Axis | Raw current | Raw baseline (30d) | Score formula |
|------|-------------|-------------------|---------------|
| **Explosive Power** | Latest day max `peak_velocity` (GymAware) | Mean of daily max peak velocities | `(current / avg) × 100` |
| **Volume** | Latest day BMP `jump_event_count` sum | Max daily BMP total | `(current / max) × 100` |
| **Intensity** | Latest day BMP `high_jump_event_count` sum | Max daily BMP high jumps | `(current / max) × 100` |
| **Fitness/Engine** | Latest session `player_load_per_minute` | Mean session load/min | `(current / avg) × 100` |
| **ACWR Safety** | Current ACWR | — | Rule-based (see below) |
| **Recovery** *(WHOOP)* | `recovery_score` | — | `clamp(0–100)` direct |
| **Sleep Eff** *(WHOOP)* | `sleep_efficiency_percentage` | — | `clamp(0–100)` direct |

**Clamp:** `clampScore(v) = max(0, min(100, round(v×10)/10))`

**ACWR Safety score** (`acwrSafetyScore`):
- `0.8 ≤ ACWR ≤ 1.3` → `100 − |1.0 − ACWR| × 60`
- `ACWR > 1.5` or `< 0.5` → **22**
- `ACWR > 1.3` or `< 0.8` → **52**
- else → **38**

**Shape:** 5 axes without WHOOP · 7 with WHOOP (`has_whoop`). Missing spokes: `value: 0`, `hasData: false` (dot hidden).

**BMP jump definitions** (toolkit `integrations/catapult/jump_events.py`):
- Total: `jump_attribute > 0`
- High: `jump_attribute ≥ 57` cs (~0.57 s → ~40 cm)

---

### 2.3 Triad risk logic

**File:** `dashboard.py` · `get_triad_risk` · **Display:** `TriadRiskCharts.jsx`

| Panel | Metric | Risk threshold |
|-------|--------|----------------|
| **Workload shock** | Daily ACWR | `ACWR > 1.5` |
| **Tissue repair** | Deep sleep hours = `total_slow_wave_sleep_time_milli / 3_600_000` | Below **30d minimum** (default floor **1.0 h**) |
| **Neuromuscular power** | Mode A: daily `max_jump_height_cm` | Below **90% of 30d ceiling** (`jump_drop_pct = 10%`) |
| | Mode B: daily high-band % = `(Σ high / Σ total) × 100` | Below **67% of 30d average ratio** |

**Neuromuscular mode selection:**
1. If `< 3` BMP height days in baseline **and** `≥ 3` ratio days → **ratio mode**
2. Else if height days exist → **max height mode**
3. Else if ratio only → ratio mode
4. Else panel empty

**Critical day:** `acwr_risk AND sleep_risk AND neuromuscular_risk` (all three red).

---

### 2.4 Efficiency scatter (load vs strain)

**File:** `dashboard.py` · `get_efficiency_scatter`

```text
Point grain: one Catapult session with same-day WHOOP cycle_strain (SCORED preferred)

efficiency_index = player_load / strain
avg_efficiency   = avg(player_load) / avg(strain)   over matched sessions
trendline_slope  = avg(strain) / avg(player_load)
expected_strain  = player_load × slope

Zone peaking:   strain < expected × 0.92  OR  EI ≥ avg_efficiency × 1.1
Zone fatigued:  strain > expected × 1.08  OR  EI ≤ avg_efficiency × 0.8
Recent flag:    days_ago ≤ recent_days − 1  (default 3)
```

Chart quadrants implied by baseline crosshairs at `avg_player_load` and `avg_strain` (not explicit Recharts `ReferenceArea` zones).

---

### 2.5 Fallback & missing-data hierarchy

| Layer | Behavior | Location |
|-------|----------|----------|
| **Chart nulls** | `connectNulls: true` on line/area series | `chartDefaults.js` |
| **Radar empty spoke** | Plots at centre; no dot | `formatRadarData.js` |
| **Triad neuromuscular** | Max height → high-band ratio → empty | `dashboard.py` triad |
| **WHOOP recovery fetch** | SCORED rows first; fallback any score_state | `whoop.py` |
| **BMP on Catapult rows** | `attach_high_jump_counts`: BMP index → else `jump_event_count` on session row | `jump_metrics.py` |
| **Readiness RAG** | WHOOP + ACWR gates; if no recovery → ACWR-only fallback | `Readiness.jsx` |
| **Readiness status copy** | UI says “prefer yesterday”; code uses **latest available** session via `latestByDate()` | `Readiness.jsx` |
| **7-day map inactive day** | Muted tile = no Catapult/GymAware session (implicit rest) | `recent7Blocks()` |
| **GymAware exercise label** | First row `exercise_name` or **“Awaiting Sync”** | Expanded row |
| **Compound lift hierarchy (CMJ / trap bar)** | **Planned only** — documented in `PLANNED_FEATURES.md`; trap-bar alias merge exists in `gymaware_exercises.py` but Readiness does not yet pick alternate lifts | Not in production Readiness |

---

## 3. Frontend Component Tree

### 3.1 Main Dashboard — three athlete charts

**Page:** `frontend/src/pages/MainDashboard.jsx` (requires `selectedAthlete` from `DashboardContext`)

```text
MainDashboard
├── useQuery → dashboardApi.radarMetrics({ athlete_key, days: 30 })
│   └── AthleteRadarChart { playerData, height: 300 }
├── useQuery → dashboardApi.triadRisk({ athlete_key, days: 14, baseline_days: 30 })
│   └── TriadRiskCharts { triadData, loading }
└── useQuery → dashboardApi.efficiencyScatter({ athlete_key, days: 30, recent_days: 3 })
    └── EfficiencyScatterChart { data, loading, height: 360 }
```

---

### 3.2 AthleteRadarChart (5 → 7 axes)

| Prop | Type | Source |
|------|------|--------|
| `playerData` | object | `/dashboard/radar-metrics` response |
| `fillColor` | string | default `#3b82f6` |
| `height` | number | default `300` |

**Internal:** `formatRadarData(playerData)` → `{ axes, axisCount, hasWhoop }`  
**Recharts:** `RadarChart` · `PolarRadiusAxis domain={[0,100]}` · `Radar dataKey="value"` · dots filtered by `hasData`

**API response shape:**
```json
{
  "current": { "peak_velocity", "total_jumps", "high_jumps", "load_per_min", "acwr", "whoop_recovery", "whoop_sleep_efficiency", "session_date" },
  "baseline_30d": { "avg_peak_velocity", "max_total_jumps", "max_high_jumps", "avg_load_per_min" },
  "has_whoop": boolean
}
```

---

### 3.3 TriadRiskCharts (3 synced area charts)

| Prop | Type | Source |
|------|------|--------|
| `triadData` | object | `/dashboard/triad-risk` |
| `loading` | boolean | TanStack Query |

**Recharts:** three `AreaChart` with `syncId="triadRisk"` · `dataKey`: `acwr` | `deep_sleep_hours` | `neuromuscular_value` · red `ReferenceArea` above/below thresholds from `triadData.thresholds`

---

### 3.4 EfficiencyScatterChart (quadrant-style scatter)

| Prop | Type | Source |
|------|------|--------|
| `data` | object | `/dashboard/efficiency-scatter` |
| `loading` | boolean | |
| `height` | number | default `360` |

**Recharts mapping:**
- `Scatter data={sessions}` · X=`player_load` · Y=`strain` · `Cell` fill by `zone` / `is_recent`
- `Line data={trend_line}` purple dashed baseline
- `ReferenceLine` at `baseline.avg_player_load`, `baseline.avg_strain`

**Session object:** `{ calendar_date, activity_name, player_load, strain, efficiency_index, zone, is_recent }`

---

### 3.5 Readiness page — daily board structure

**Page:** `frontend/src/pages/Readiness.jsx` · Route: `/readiness`

**Data sources (parallel queries):**

| Query | API | Purpose |
|-------|-----|---------|
| `readiness-snapshot` | `GET /dashboard/team-snapshot` | ACWR, recovery, load per athlete |
| `athletes` | `GET /athletes/` | Roster names |
| `readiness-cat7-team` | `GET /catapult/sessions?days=7` | 7d session dates |
| `readiness-gym7-team` | `GET /gymaware/sessions?days=7` | 7d gym dates |
| `readiness-rec7-team` | `GET /whoop/recovery?days=7` | WHOOP recovery |
| `readiness-work7-team` | `GET /whoop/workout?days=7` | Calories |

**Main table columns → fields:**

| Column | Computed from |
|--------|---------------|
| Player Name | `athlete_display_name` |
| Status | `readinessStatus(acwr, recovery)` → Red/Yellow/Green/Insufficient |
| Readiness | `buildReadiness(acwr, recovery)` 0–100 |
| ACWR | `acwr`, `acwr_status`, acute/chronic tooltip |
| 7D Sessions | Union count of Catapult + GymAware dates (7d) |
| Total Jumps & Load | Latest Catapult day: `total_jumps`, `total_player_load` |
| WHOOP | recovery% / sleep% / calories or “No Device” |
| GymAware Core | Max `peak_velocity` on latest gym day |

**Readiness score:**
```text
if recovery and acwr:
  readiness = clamp(recovery − penalty, 0, 100)
  penalty = 35 if acwr>1.5 | 18 if acwr>1.3 | 12 if acwr<0.8 | 0
```

**Expanded row (`ExpandedAthleteRow`):**
- 2-column grid: GymAware card | Catapult card
- 7-day history map (click day → `?athlete=&day=` URL params)
- WHOOP footer line
- Per-athlete refetch of 7d Catapult/GymAware/WHOOP when expanded

---

## 4. Pre-Handover Security Specification (Roadmap)

### 4.1 Current environment structure

| Location | Variables | Committed? |
|----------|-----------|------------|
| `Capstone-team54-volleyball-toolkit/.env.example` | `DATABASE_URL`, `CATAPULT_TOKEN`, `GYMAWARE_*`, `WHOOP_*`, `VALD_*`, `ROSTER_FILTER`, `ROSTER_ALLOWLIST_XLSX` | Yes (template) |
| `Capstone-team54-volleyball-toolkit/.env` | Filled secrets | **No** (gitignored) |
| `vpa/.../backend/.env` | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `AUTH_ENABLED`, `SUPABASE_JWT_SECRET`, `ALLOWED_ORIGINS` | **No** |
| `vpa/.../frontend/.env.local` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_AUTH_DISABLED` | **No** |
| GitHub Actions | Repository secrets mirror toolkit `.env` | Secrets UI only |

**Runtime today:**
- Backend uses **service role** for all silver reads (bypasses RLS until enabled).
- Frontend auth: Supabase MFA path in progress; `AUTH_ENABLED=false` locally; dashboard routes **not** yet wrapped in `require_auth`.

**Sensitive tables:** `whoop_oauth_tokens` — comment in schema says lock down with RLS (tokens must not be client-readable).

---

### 4.2 RLS policies to apply before client handover (draft)

**Prerequisites:**
1. Enable RLS on silver views’ underlying tables **or** expose read-only **`api_*` views** with RLS.
2. Supabase Auth `profiles` table: `{ id uuid PK, role text CHECK (role IN ('coach','athlete')) }`.
3. Athletes map to `profiles.id` ↔ `athlete_identity.internal_key` (column to add at handover).

**Recommended pattern:** coaches read all cohort athletes; athletes read self only.

```sql
-- Example: silver_catapult_session read policy (apply after athlete_user_id mapping exists)

ALTER TABLE public.athlete_identity ENABLE ROW LEVEL SECURITY;

CREATE POLICY coach_read_all_athletes ON public.athlete_identity
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'coach'
    )
  );

CREATE POLICY athlete_read_self ON public.athlete_identity
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- Silver views: enable RLS on base tables OR create secure views:

CREATE POLICY coach_read_silver_catapult ON public.catapult_stats_bi_extract
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'coach')
  );

-- Service role (ETL + FastAPI server): no policy needed — uses service key, not auth.uid()

-- Deny anon direct access:
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT ON silver_* TO authenticated;  -- after policies attached
```

**Mutation rules (handover):**
| Role | Silver / BI tables | Staging / tokens |
|------|-------------------|-------------------|
| `coach` | SELECT only via RLS | No access |
| `athlete` | SELECT own rows only | No access |
| `service_role` | INSERT/UPDATE (ETL) | Full (backend only) |
| `anon` | **Deny** | **Deny** |

**FastAPI cutover:** When `AUTH_ENABLED=true`, attach `Depends(require_auth)` to dashboard routers; forward user JWT to PostgREST with **`SUPABASE_ANON_KEY`** + user token (not service key) so RLS applies.

---

### 4.3 Handover checklist (security)

- [ ] Rotate any secret ever shared in chat/email
- [ ] Populate GitHub Actions secrets; never commit `.env`
- [ ] Deploy frontend with `VITE_SUPABASE_*` only (anon key)
- [ ] Deploy backend with service key **server-side only**
- [ ] Apply RLS migration in Supabase SQL editor
- [ ] Set `AUTH_ENABLED=true` in production
- [ ] Remove `VITE_AUTH_DISABLED` from all deploy envs
- [ ] Confirm `whoop_oauth_tokens` has RLS deny for `authenticated` / `anon`

---

## Repository reference (pitch)

| Repo | Role in pitch |
|------|---------------|
| `Capstone-team54-volleyball-toolkit` | **Source of truth** for schema + ETL |
| `vpa/Volleyball_Performance_Analysis` | **Full dashboard** (radar, triad, efficiency, auth) |
| `Beach-Volleyball-Data-Analysis-Web-Dashboard` | Portfolio bundle; `etl-toolkit/` ≈ toolkit copy; `web-dashboard/` ≈ older VPA snapshot |

**Deep dives:** `vpa/docs/CHARTS.md` · `toolkit/docs/volley-etl/catapult_bmp_jumps_handover.md` · `toolkit/docs/operations/vpa_frontend_integration.md`

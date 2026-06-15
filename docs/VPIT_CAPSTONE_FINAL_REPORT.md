# Volleyball Performance Intelligence Toolkit (VPIT)  
## Capstone Final Report — Team 54

**Document status:** Draft for submission (presentation complete)  
**Prepared by:** Sai Ganesh Potukuchi (`potsy017`) — sole contributor with access to all repositories  
**Date:** 2 June 2026  
**Supabase project:** `tvbavuzjtzyqwmycoxzh`  
**Jira / sprint evidence:** *On hold — to be inserted when reports are provided*

---

## Executive summary

VPIT is a **headless ETL + analytics platform** for the Australian Volleyball national program. Vendor data (Catapult, GymAware, WHOOP, VALD) is ingested into **Supabase Postgres** using a bronze → silver medallion model. The **primary deliverable** is a **React + FastAPI web dashboard** (`vpa/Volleyball_Performance_Analysis`) used for daily coaching decisions: ACWR, readiness RAG, radar profiles, triad injury-risk charts, load–efficiency scatter, BMP jump analytics, and GymAware load–velocity analysis.

A **Power BI semantic layer** exists as an **optional executive / analyst add-on** (not the main product). The ETL toolkit documentation explicitly **deprioritises Power BI** in favour of the custom web UI; silver views were designed so either consumer can read the same deduplicated data.

**Security at handover:** Row Level Security (RLS) is **documented and scheduled for deployment** but **not yet enabled**. The backend currently uses the **Supabase service role** for all silver reads. Production login uses **Supabase Auth with email OTP (MFA-style second factor)**. Local development may set `AUTH_ENABLED=false` (backend) and `VITE_AUTH_DISABLED=true` (frontend) — these flags are **not for production**.

---

## 1. Team structure and repository access

### 1.1 Repositories

| Repository | Role | Primary branch |
|------------|------|----------------|
| `Capstone-team54-volleyball-toolkit` | **Source of truth** — schema DDL, ETL scripts, silver views, ops docs | `main` |
| `vpa/Volleyball_Performance_Analysis` | **Production application** — FastAPI BFF + React dashboard | `main` |
| `Beach-Volleyball-Data-Analysis-Web-Dashboard` | Portfolio monorepo bundling ETL + older UI snapshot for product review | `main` |

**Access note:** Only **Sai Ganesh Potukuchi** maintained working copies of and commits across **all three** repositories. Other team members contributed to individual repos (see §2). Cross-repo integration, silver schema alignment, dashboard analytics, and handover documentation were performed centrally by the ETL / integration lead.

### 1.2 Team roles (functional)

| Area | Lead contributors (from git + project records) |
|------|-----------------------------------------------|
| ETL, silver schema, roster, BMP jumps, ops runbooks | Sai Ganesh (`potsy017`) |
| React UI scaffold, hosting, nginx, early dashboard shell | Mithun Srinivasan |
| Catapult page / high-jump chart tweaks | Adithya Reddy |
| Initial repo scaffolding (folders, requirements, early backend stub) | Caiyh123 |
| Power BI prototypes (complementary) | Adithya Reddy (`Prototype_1.pbix` in toolkit); Haojun / Yanheng per team planning docs |
| Auth MFA flow (`AuthPage.jsx`), Readiness, radar/triad/efficiency, jump metrics | Sai Ganesh (`potsy017`) on VPA `main` |

---

## 2. Version control contributions

Counts from `git shortlog -sn --all` (all branches), run 2 June 2026.

### 2.1 `Capstone-team54-volleyball-toolkit`

| Commits | Author | Email (from git) | Active period |
|--------:|--------|------------------|---------------|
| 45 | potsy017 (Sai Ganesh) | saiganesh.potukuchi@student.adelaide.edu.au | Mar 2026 – Jun 2026 |
| 12 | Caiyh123 | 2335459880@qq.com | Early scaffolding |
| 1 | Adithya Reddy | GitHub noreply | Power BI prototype |

**Representative work — Sai Ganesh (toolkit):**

- Bronze BI extract tables and silver views (`silver_catapult_session`, `silver_catapult_jump_session`, `silver_whoop_*`, `silver_gymaware_*`)
- Roster pipeline (`roster_new.xlsx` → `roster_cohort`, `athlete_identity`)
- Catapult BMP jump export and automated ETL repairs (`scheduled_etl.py`, nightly retry)
- WHOOP Auth Bridge Railway deploy config
- Product review documentation, handover guides, testing notes
- VALD ForceFrame / ForceDecks upload fixes

**Representative work — Caiyh123:** initial folder structure, `requirements`, backend/frontend stubs, meeting-notes scaffold.

**Representative work — Adithya Reddy:** `Prototype_1.pbix` (Power BI executive prototype).

### 2.2 `vpa/Volleyball_Performance_Analysis`

| Commits | Author | Active period |
|--------:|--------|---------------|
| 21 | Mithun Srinivasan | May 2026 |
| 15 | Sai Ganesh (`potsy017`) | May–Jun 2026 |
| 6 | Adithya Reddy | May 2026 |

**Representative work — Mithun Srinivasan:**

- Initial React dashboard commit and UI shell
- Hosting / nginx configuration, deployment URL updates
- Early Catapult UI changes, logo/toggle tweaks
- Login page scaffolding (`LoginPage.jsx` — superseded by unified `AuthPage.jsx` on `main`)

**Representative work — Sai Ganesh (VPA `main`):**

- Readiness squad page with ACWR + recovery RAG
- GymAware load–velocity analysis
- Dashboard charts: radar, triad risk, efficiency scatter, daily jumps, ACWR chart
- BMP jump metrics backend (`jump_metrics.py`) and UI clarity (total vs high jumps)
- Local dev auth bypass (`VITE_AUTH_DISABLED`) and `SETUP.md`
- Backend config and router integration

**Representative work — Adithya Reddy:**

- Catapult high-jump chart edits per client feedback
- `catapult.py` router updates

**Branches:** `main` (current delivery), `client-changes-sai` (client iteration snapshot on remote).

### 2.3 `Beach-Volleyball-Data-Analysis-Web-Dashboard`

| Commits | Author |
|--------:|--------|
| 2 | potsy017 (Sai Ganesh) |

Portfolio monorepo created to package ETL toolkit copy, web-dashboard snapshot, and product-review docs for university deliverables. The **live feature set** is on VPA `main`, not the bundled `web-dashboard/` subtree (which lacks radar, triad, and efficiency endpoints).

---

## 3. System architecture

### 3.1 Data pipeline (medallion)

```text
Vendor APIs (Catapult / GymAware / WHOOP / VALD)
        ↓
Bronze staging + *_bi_extract tables (append-only)
        ↓
Silver views (dedupe, roster keys, calendar_date)
        ↓
FastAPI BFF (PostgREST via service role) → React (TanStack Query + Recharts)
```

**Join keys:** `athlete_internal_key` (`VB-{gymaware_ref}`) + `calendar_date`  
**Roster source:** `data/roster/roster_new.xlsx` → `roster_cohort` + `athlete_identity`

### 3.2 Application pattern

- Browser calls **`/api/*`** only for performance metrics (no direct silver queries from React).
- **`@supabase/supabase-js`** in the frontend is used for **authentication** and `profiles.role` lookup.
- Backend module `app/db/supabase.py` uses **httpx → PostgREST** with `SUPABASE_SERVICE_KEY`.

### 3.3 Primary vs optional delivery

| Deliverable | Status | Audience |
|-------------|--------|----------|
| **React web dashboard** (VPA) | **Primary — shipped on `main`** | Coaches, performance staff, daily use |
| **Power BI reports** (`Prototype_1.pbix`, planned `VDIT_1.pbix` / analyst package) | **Optional executive layer** | Leadership, seasonal PDFs, analyst self-serve |
| ETL + silver (toolkit) | **Required infrastructure** | Both consumers above |

Power BI connects to the **same silver views** (e.g. `silver_gymaware_summaries`; slicer `athlete_display_name`). Toolkit runbooks warn against querying raw `*_bi_extract` in reports (duplicate KPI risk).

---

## 4. Features delivered

### 4.1 Shipped (VPA `main`)

| Feature | API / route | Notes |
|---------|-------------|-------|
| Main dashboard KPIs + time series | `/api/dashboard/kpis`, `/summary`, `/daily-jumps` | 28d / 1m / 3m / 6m windows |
| **Radar profile** (5–7 axes) | `/api/dashboard/radar-metrics` | Catapult load, BMP jumps, GymAware velocity, WHOOP recovery/sleep |
| **Triad injury risk** | `/api/dashboard/triad-risk` | ACWR + deep sleep + neuromuscular (jump height or high-band ratio) |
| **Efficiency scatter** | `/api/dashboard/efficiency-scatter` | Catapult load vs WHOOP strain, same-day join |
| **Readiness table** | `/api/readiness` | Squad RAG from ACWR + recovery |
| Catapult session log + BMP peaks | `/api/catapult/*` | High jumps from BMP threshold (≥57 cs ≈ 40 cm) |
| GymAware load–velocity | `/api/gymaware/load-velocity-analysis` | Trap-bar and fixed-load profiles |
| WHOOP recovery / sleep views | `/api/whoop/*` | Subject to OAuth token coverage |
| Supabase MFA auth | `AuthPage.jsx` | Password verify → signOut → email OTP → verify |
| Profile init on signup | `POST /api/init-profile` | Service role upsert after OTP |

### 4.2 Planned (not shipped)

| Feature | Reference |
|---------|-----------|
| Readiness vs. Reality / CNS masking matrix | `docs/PLANNED_FEATURES.md` |
| Full-roster WHOOP automation at scale | Ops roadmap |
| VALD ForceDecks depth in UI | `silver_vald_*` referenced; DDL partial in toolkit |
| Production RLS + JWT-guarded API routes | §5 |

### 4.3 BMP jumps — design clarification

Total jumps and high jumps are **intentionally close** (~95–98% ratio): BMP “high” uses a **height threshold**, not a separate jump taxonomy. UI labels and High Jump % KPI were added to prevent misinterpretation as a data bug.

---

## 5. Security: current state vs post-RLS deployment

### 5.1 Current state (pre-RLS, development / staging)

| Layer | Behaviour | Risk if left unchanged |
|-------|-----------|------------------------|
| **Postgres / Supabase** | RLS **not enabled** on silver paths | Any holder of service role or broad DB access sees all rows |
| **FastAPI** | `AUTH_ENABLED=false` locally; dashboard routers **not** wrapped in `require_auth` | Unauthenticated API access if backend is exposed |
| **Frontend** | Optional `VITE_AUTH_DISABLED=true` (gitignored `.env.local`) | Bypasses login gate in dev only |
| **Secrets** | `.env` gitignored; GitHub Actions secrets for ETL | Good practice maintained |
| **WHOOP tokens** | `whoop_oauth_tokens` table — schema comments require lockdown | Tokens must not be client-readable |

**Why service role today:** Accelerated capstone integration — single server-side key simplifies PostgREST reads while silver views and API contracts were stabilised. Appropriate for **trusted dev/staging**; **not** the production end state.

### 5.2 Target state (post-RLS deployment at handover)

| Layer | Behaviour |
|-------|-----------|
| **RLS on base tables / secure views** | `coach` role: SELECT cohort athletes; `athlete` role: SELECT own rows only; `anon`: deny |
| **`profiles` mapping** | `profiles.id` ↔ `athlete_identity` (add `profile_id` at cutover) |
| **`whoop_oauth_tokens`** | Deny `authenticated` / `anon`; ETL service role only |
| **FastAPI** | `AUTH_ENABLED=true`; `Depends(require_auth)` on dashboard routers |
| **PostgREST reads** | Forward user JWT with **anon key** (not service key) so RLS applies |
| **Frontend deploy** | `VITE_SUPABASE_*` only; **remove** `VITE_AUTH_DISABLED` |
| **Power BI** | Read-only DB role or views **without** OAuth token columns |

Draft SQL policies and cutover checklist: `docs/FINAL_PITCH_HANDOVER.md` §4.2–4.3.

### 5.3 Authentication (production)

**Supabase MFA login** is implemented in `AuthPage.jsx`:

1. **Login:** `signInWithPassword` → `signOut` → `signInWithOtp` (email) → user enters OTP → `verifyOtp` → session established.
2. **Signup:** client checks password match + length → `signUp` → `signOut` → OTP → `verifyOtp` → `POST /api/init-profile` (service role upsert).

`LoginPage.jsx` and `SignupPage.jsx` exist but **`App.jsx` routes to `AuthPage` only** (unified flow).

**Local-only flags (do not deploy):**

- `AUTH_ENABLED=false` — backend returns mock coach user in `get_current_user()` when disabled.
- `VITE_AUTH_DISABLED=true` — frontend skips auth gate (documented in `SETUP.md`).

### 5.4 Password policy

| Layer | Rules enforced in codebase |
|-------|---------------------------|
| **Frontend (`AuthPage.jsx`, `SignupPage.jsx`)** | Passwords must **match**; minimum **6 characters** before `signUp` |
| **Supabase Auth (project settings)** | Additional strength rules (uppercase, digits, symbols, longer minimum) may be configured in the Supabase dashboard and are enforced **server-side** on `signUp` / password change |

If signup fails with messages such as *“Password should be at least X characters”* or requirements for mixed case / symbols, that rejection comes from **Supabase GoTrue**, not the React validator. The UI surfaces `err.message` from Supabase directly. **Recommendation for production:** align Supabase dashboard password policy with university/client IT standards and mirror requirements in frontend helper text.

### 5.5 Frontend security testing

The React application is **undergoing vulnerability testing** separately. Backend and data-layer checks are reported in §6.

---

## 6. Testing and verification

### 6.1 Backend tests executed (2 June 2026, re-verified)

| Test | Command / method | Result |
|------|------------------|--------|
| Python compile (toolkit) | `python -m compileall integrations upload_to_supabase.py scheduled_etl.py` | **PASS** |
| Python compile (VPA backend) | `python -m compileall app` | **PASS** |
| API health | `TestClient GET /api/health` | **PASS** — `{"status":"ok","service":"VPA API"}` |
| OpenAPI schema | `GET /openapi.json` | **PASS** — 200 |
| ACWR utility | `compute_acwr`, `daily_load_totals` unit assertions | **PASS** |
| Jump metrics utility | `high_jump_from_row`, `total_jump_from_row` | **PASS** |
| Preflight env | `python scripts/preflight_config.py` (toolkit) | **PASS** — all required env vars present |
| **Vendor API connectivity** | `python verify_integrations.py` (toolkit) | **PASS** — exit code 0 |
| ↳ Catapult | `GET …/athletes` | **PASS** — 37 athlete row(s) visible |
| ↳ GymAware | `GymAwareClient.list_athletes()` | **PASS** — 793 athlete row(s) from API |
| ↳ VALD | OAuth token + tenants | **PASS** — tenant response received |
| **Live Supabase read** | `GET /api/athletes` via TestClient | **PASS** — 200, **16 athletes** returned |

**Re-run note:** An initial run on the same day hit **network timeouts** to Catapult, GymAware, VALD, and Supabase from the test machine. After connectivity improved, all live integration and API tests **passed** in a single `verify_integrations.py` run (~9 s) and athletes fetch (~7 s).

**Interpretation:** Application code, routing, pure-Python analytics utilities, **vendor API credentials**, and **live Supabase reads** are verified end-to-end from the development environment. This aligns with prior ETL success documented in `docs/operations/testing_notes.md` (scheduled `--all` run in the team environment).

### 6.2 Automated test gap

There is **no `pytest` suite** or `test_*.py` in the VPA backend repository. Verification relies on:

- GitHub Actions `compileall` (toolkit CI)
- Manual smoke matrix (V1–V9 in `testing_notes.md`)
- Preflight and `verify_integrations.py`

**Recommendation:** add `pytest` + `TestClient` fixtures for `/api/dashboard/*` with mocked PostgREST responses before production cutover.

### 6.3 ETL manual test matrix (documented)

Representative cases T1–T6 (roster sync, roster-filtered Catapult, GymAware extended, WHOOP ETL, silver apply, cross-source filter) and V1–V9 (VPA UI smoke) are defined in `Capstone-team54-volleyball-toolkit/docs/operations/testing_notes.md`.

---

## 7. Known limitations and honest scope

| Limitation | Detail |
|------------|--------|
| VALD data | ForceDecks / ForceFrame pipelines exist; UI route is placeholder; silver VALD DDL incomplete |
| WHOOP coverage | Dependent on per-athlete OAuth; not full roster |
| Catapult stats grain | Team/session blocks may be sparse; jumps often BMP-only on jump silver |
| Beach monorepo UI | Older snapshot — missing radar, triad, efficiency |
| `APP_DOCUMENTATION.pdf` | Contains inaccuracies (e.g. `StaggeredMenu`, JWT on all routes, signup order); corrected narrative in this report and `docs/FINAL_PITCH_HANDOVER.md` |
| Entra ID SSO | Documented as future client option; current auth is Supabase native + OTP |

---

## 8. Operations and deployment

| Component | Mechanism |
|-----------|-----------|
| ETL schedule | `scheduled_etl.py --all`; GitHub Actions / cron |
| WHOOP OAuth | Railway-hosted Auth Bridge (`docs` in toolkit) |
| VPA API | FastAPI on port 8000; Vite dev proxy `/api` → backend |
| VPA frontend hosting | Mithun’s nginx / hosting commits; production URL in team records |
| Schema migrations | `schema/apply_order.txt` — apply in Supabase SQL Editor |

---

## 9. Documentation index

| Document | Purpose |
|----------|---------|
| `docs/COMPLETE_HANDOVER_PLAN.md` | Monorepo migration, Railway, WHOOP cutover, checklists |
| `docs/FINAL_PITCH_HANDOVER.md` | Technical handover, RLS draft, API map |
| `docs/VPIT_FINAL_PRESENTATION_SPEAKER_NOTES.md` | Presentation narrative (codebase-aligned) |
| `vpa/.../docs/CHARTS.md` | Chart definitions and thresholds |
| `Capstone-team54-volleyball-toolkit/docs/operations/testing_notes.md` | Test matrices |
| `Capstone-team54-volleyball-toolkit/README_HANDOVER.md` | ETL env vars and first run |
| `vpa/.../SETUP.md` | Local dev including auth flags |

---

## 10. Jira and project management evidence

**Status: ON HOLD**

Sprint boards, burndown, and ticket exports will be inserted when provided by the team lead. Placeholder section for:

- Epic / story mapping to delivered features
- Velocity or sprint count
- Client change requests traceability (e.g. high-jump chart edits)

---

## 11. Conclusion

VPIT delivers a **working, codebase-verified analytics stack**: automated multi-vendor ETL into silver Supabase views, and a **React dashboard** with readiness, ACWR, radar, triad, efficiency, and BMP jump intelligence. The architecture separates **bronze audit** from **silver coaching metrics**, with a single roster join model across sources.

**Primary delivery** is the web application. **Power BI** remains a valid **executive optional** channel on the same silver layer. **RLS and API JWT enforcement** are the remaining production hardening steps, with draft policies already written. **Supabase OTP MFA** is live in the auth UI for production login; local auth bypass flags are confined to development.

Cross-repository integration and handover documentation were centralised by the ETL/integration lead because only one team member held access to all repositories — this report reflects that consolidated view.

---

## Appendix A — VPA API routes (backend `main`, 34 routes)

Core dashboard: `/api/health`, `/api/dashboard/kpis`, `/summary`, `/daily-jumps`, `/radar-metrics`, `/triad-risk`, `/efficiency-scatter`, `/team-snapshot`, `/readiness`, `/catapult/*`, `/gymaware/*`, `/whoop/*`, `/init-profile`.

## Appendix B — Questions for team / assessors

1. **Git identity:** Confirm display name for `Caiyh123` (2335459880@qq.com) for official attribution.
2. **Submission format:** Individual vs team report; university word limit or template?
3. **Jira:** Which boards/export format to embed in §10?
4. **Power BI artefact:** Confirm filename/location of latest `.pbix` for appendix (e.g. `VDIT_1.pbix`).
5. **Supabase password policy:** Confirm dashboard settings screenshot for appendix (if assessors require evidence beyond code).

---

*End of report draft.*

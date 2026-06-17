# Portfolio showcase (repo only)

This project is published as a **public code portfolio** — no live Supabase, Render, or Railway instances are maintained.

Reviewers and recruiters should use:

1. **This repository** — architecture, ETL, API, and UI source  
2. **Screenshots** — attach to LinkedIn or add under `docs/screenshots/` (optional)  
3. **Local run** (optional) — only if you provision your own Postgres/Supabase and env files  

---

## What to look at in the repo

| Area | Path | Highlights |
|------|------|------------|
| Dashboard API | `backend/app/` | FastAPI routers, silver reads, jump metrics |
| React UI | `frontend/src/` | Readiness, radar, triad charts, GymAware/Catapult pages |
| ETL orchestration | `etl/scheduled_etl.py` | Multi-vendor pipeline, roster sync |
| Silver schema | `etl/schema/` | Medallion DDL, `apply_order.txt` |
| Integrations | `etl/integrations/` | Catapult, GymAware, WHOOP, VALD clients |
| Chart ↔ API map | `docs/CHARTS.md` | Every dashboard chart and endpoint |
| System design | `etl/docs/design/system_design.md` | End-to-end data flow |

---

## Optional: run locally

You need your **own** database with silver views populated (or an empty DB for API/UI smoke only).

1. Copy `backend/.env.example` → `backend/.env` (Postgres/Supabase URL + service key)  
2. Copy `frontend/.env.example` → `frontend/.env.local`  
3. For UI without login: `AUTH_ENABLED=false`, `VITE_AUTH_DISABLED=true`  
4. See **[SETUP.md](../SETUP.md)** and `docker-compose.yml`  

ETL against real vendors requires `etl/.env` with API credentials — not included in this repo.

---

## Shutting down hosted services (owner checklist)

When decommissioning capstone infrastructure:

| Service | Action |
|---------|--------|
| **Supabase** | Export schema/SQL if needed → delete or pause project → rotate any keys that were in `.env` |
| **Render / Railway** | Delete dashboard, API, and WHOOP bridge services |
| **GitHub Actions secrets** | Remove vendor/DB secrets if any workflows used them |
| **WHOOP Developer app** | Remove old redirect URIs for deleted hosts |
| **This repo** | Stays public as portfolio; no secrets in git |

---

## LinkedIn / CV wording

> Full-stack sports analytics capstone: multi-vendor ETL (Catapult, GymAware, WHOOP, VALD) into a Postgres silver layer, React coaching dashboard (ACWR, readiness, injury-risk triad, jump analytics), FastAPI BFF. Source: github.com/potsy017/volleyball-performance-analytics

Link the **repo**, not a live demo URL.

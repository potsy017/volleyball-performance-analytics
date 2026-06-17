# Portfolio repo setup

Steps to move this project off the client/capstone org repo into your **private** GitHub.

---

## 1. Create private repo

On GitHub: **New repository** → name e.g. `volleyball-performance-analytics` → **Private** → no README (you already have one).

---

## 2. Point local git at the new remote

From `Volleyball_Performance_Analysis/`:

```powershell
git remote -v
git remote rename origin client-archive
git remote add origin https://github.com/YOUR_USERNAME/volleyball-performance-analytics.git
git push -u origin main
```

Keep `client-archive` only if you need to pull once more; otherwise remove it:

```powershell
git remote remove client-archive
```

---

## 3. Disconnect client infrastructure (your checklist)

| Service | Action |
|---------|--------|
| **Client GitHub org** (`Chandler-targaryen/...`) | Archive or leave; you no longer push there |
| **GitHub Actions secrets** | On client repo — no action needed if you stopped using it |
| **Railway WHOOP bridge** | Client-owned; you can delete your deploy access or leave for them |
| **Supabase** | Rotate service role key if it was ever shared; portfolio uses your own `.env` locally |
| **Vendor API tokens** | Rotate Catapult / GymAware / VALD / WHOOP if committed or shared in chat |

---

## 4. What was removed for portfolio

- Client handover docs (`HANDOVER.md`, capstone report, pitch brief, viva prep)
- `daily-etl.yml` (client CI — not needed for portfolio)
- Roster `.xlsx` from git (real names — keep local only, gitignored)

**Kept:** application code, ETL, schema SQL, technical docs (`CHARTS.md`, system design), `ci-etl.yml` (compile check).

---

## 5. Before making repo public later

- [ ] Rotate all secrets in `backend/.env`, `etl/.env`
- [ ] Scrub git history if secrets were ever committed (`git log -p` search for keys)
- [ ] LinkedIn screenshots already blurred
- [ ] Optional: swap Supabase for a fresh demo project with synthetic data

---

## 6. LinkedIn post (ready when you are)

Use your blurred screenshots + caption from capstone work:

- Multi-vendor ETL → Supabase silver layer
- React dashboard: readiness, ACWR, radar, triad, jump analytics
- FastAPI BFF, GitHub Actions pipeline, OAuth WHOOP bridge

Link to private repo only if you later make a public demo or write a dev.to / portfolio site article.

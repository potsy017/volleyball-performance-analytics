# Portfolio notes

**Repo:** https://github.com/potsy017/volleyball-performance-analytics (public, source-only)

## Strategy

- **Keep:** GitHub repo as the portfolio artifact (code + docs + CI compile check).
- **Retire:** Supabase, Render, Railway, and other hosted services.
- **Showcase:** LinkedIn screenshots + repo link — see [docs/SHOWCASE.md](docs/SHOWCASE.md).

## Decommission checklist

- [x] Delete/pause Supabase project; rotate keys that were in local `.env`
- [x] Delete Render services (if any)
- [x] Railway — left with frontend lead (out of scope)
- [x] Remove GitHub Actions secrets on portfolio / old repos
- [ ] Delete local `.env` files when ready (`backend/.env`, `etl/.env`, `frontend/.env.local`)
- [ ] Remove WHOOP redirect URIs for deleted hosts (if applicable)
- [x] Local ETL export JSON cleared from workspace

## In git

- No `.env`, no roster `.xlsx`, no client handover docs
- Deploy configs (`render.yaml`, `railway.toml` at repo root) removed — hosting not maintained
